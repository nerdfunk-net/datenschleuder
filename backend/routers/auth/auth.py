"""
Authentication router for login and token management.
"""

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status

from core.auth import create_access_token, get_api_key_user
from limiter import limiter
from models.auth import LoginResponse, UserLogin
from services.auth.login_service import build_user_response, get_user_with_rbac_safe

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
def login(request: Request, user_data: UserLogin):
    """
    Authenticate user against new user database.
    """
    from config import settings
    from services.auth.user_management import authenticate_user

    try:
        # Authenticate against new user database
        user = authenticate_user(user_data.username, user_data.password)

        if user:
            logger.info("Authenticated user %s (id=%s)", user["username"], user["id"])

            # Get user with RBAC roles
            user_with_roles = get_user_with_rbac_safe(user)
            response_user = build_user_response(user_with_roles)

            access_token_expires = timedelta(
                minutes=settings.access_token_expire_minutes
            )
            access_token = create_access_token(
                data={
                    "sub": user["username"],
                    "user_id": user["id"],
                    "permissions": user["permissions"],  # Legacy bitwise for token
                },
                expires_delta=access_token_expires,
            )

            from services.audit.audit_service import record_login_success

            record_login_success(
                username=user["username"],
                user_id=user["id"],
                authentication_method="password",
                extra_data={"roles": response_user["roles"]},
            )

            return LoginResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.access_token_expire_minutes * 60,
                user=response_user,
            )
    except Exception as e:
        # Log the error but don't expose it to the user
        logger.error("Authentication error for user %s: %s", user_data.username, e)

    # No valid authentication found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/refresh", response_model=LoginResponse)
def refresh_token(request: Request):
    """Issue a new access token for the currently authenticated user.

    Accept expired access tokens for the purpose of refreshing, but always
    verify the token signature. This prevents race conditions where a token
    expires just before the refresh call.
    """
    import jwt as pyjwt

    from config import settings
    from services.auth.user_management import get_user_by_username

    # Extract Authorization header
    auth_header = request.headers.get("authorization") or request.headers.get(
        "Authorization"
    )
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1].strip()

    try:
        # Decode token but do NOT verify expiration here; still verify signature.
        payload = pyjwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            options={"verify_exp": False},
        )
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Enforce a 1-hour grace window: tokens expired more than 1 hour ago cannot
        # be refreshed. This prevents indefinite refresh of old/stolen tokens while
        # still handling race conditions where a token expires just before the call.
        exp = payload.get("exp", 0)
        from time import time

        if time() - exp > 3600:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token too old to refresh, please log in again",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get current user data from database
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user with RBAC roles - same as login endpoint
        user_with_roles = get_user_with_rbac_safe(user)

        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "user_id": user["id"],
                "permissions": user["permissions"],
            },
            expires_delta=access_token_expires,
        )

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user=build_user_response(user_with_roles),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Token refresh failed for user %s: %s", username, exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/api-key-login", response_model=LoginResponse)
def api_key_login(user_info: dict = Depends(get_api_key_user)):
    """
    Authenticate using API key and return JWT token.
    This endpoint allows API key holders to get JWT tokens for accessing protected endpoints.
    """
    from config import settings

    try:
        # User is already authenticated via API key, now generate JWT token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user_info["username"],
                "user_id": user_info["user_id"],
                "permissions": user_info["permissions"],
            },
            expires_delta=access_token_expires,
        )

        from services.audit.audit_service import record_login_success

        record_login_success(
            username=user_info["username"],
            user_id=user_info["user_id"],
            authentication_method="api_key",
        )

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user={
                "id": user_info["user_id"],
                "username": user_info["username"],
                "realname": user_info.get("realname", ""),
                "role": "api_user",
                "permissions": user_info["permissions"],
                "debug": False,
            },
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate access token",
        )


@router.post("/logout")
def logout(request: Request):
    """
    Log user logout event.

    This endpoint is called by the frontend when a user logs out.
    It logs the logout event to the audit log for tracking purposes.
    The actual token invalidation happens client-side by removing the token.
    """
    import jwt as pyjwt

    from config import settings

    # Try to get user info from token if available
    try:
        # Extract Authorization header
        auth_header = request.headers.get("authorization") or request.headers.get(
            "Authorization"
        )
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

            # Decode token to get user info
            payload = pyjwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            username = payload.get("sub")
            user_id = payload.get("user_id")

            if username:
                from services.audit.audit_service import record_logout

                record_logout(username=username, user_id=user_id)
    except Exception as e:
        # If we can't get user info, log generic logout
        logger.warning("Logout called but could not extract user info: %s", e)

    return {"success": True, "message": "Logged out successfully"}
