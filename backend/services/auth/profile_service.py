"""User profile service.

Extends the user system with profile information (API keys, realname, email).
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional
from repositories import ProfileRepository
from core.models import UserProfile


def _profile_to_dict(profile: UserProfile) -> Dict[str, Any]:
    return {
        "id": profile.id,
        "username": profile.username,
        "realname": profile.realname,
        "email": profile.email,
        "debug": profile.debug_mode,
        "api_key": profile.api_key,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


class ProfileService:
    def __init__(self):
        self.profile_repo = ProfileRepository()

    def get_user_profile(self, username: str) -> Optional[Dict[str, Any]]:
        profile = self.profile_repo.get_by_username(username)
        if profile:
            return _profile_to_dict(profile)
        return {
            "username": username,
            "realname": "",
            "email": "",
            "debug": False,
            "api_key": None,
        }

    def update_user_profile(
        self,
        username: str,
        realname: Optional[str] = None,
        email: Optional[str] = None,
        debug_mode: Optional[bool] = None,
        api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = self.profile_repo.get_by_username(username)
        now = datetime.utcnow()
        if existing:
            update_kwargs = {}
            if realname is not None:
                update_kwargs["realname"] = realname
            if email is not None:
                update_kwargs["email"] = email
            if debug_mode is not None:
                update_kwargs["debug_mode"] = debug_mode
            if api_key is not None:
                update_kwargs["api_key"] = api_key
            update_kwargs["updated_at"] = now
            updated = self.profile_repo.update(existing.id, **update_kwargs)
            return _profile_to_dict(updated)
        else:
            new_profile = self.profile_repo.create(
                username=username,
                realname=realname or "",
                email=email or "",
                debug_mode=debug_mode if debug_mode is not None else False,
                api_key=api_key,
                created_at=now,
                updated_at=now,
            )
            return _profile_to_dict(new_profile)

    def update_user_password(self, username: str, new_password: str) -> bool:
        from services.settings.credentials_service import CredentialsService
        cred_svc = CredentialsService()
        try:
            credentials = cred_svc.list_credentials(include_expired=False)
            user_cred = None
            for cred in credentials:
                if cred["username"] == username and cred["status"] == "active":
                    user_cred = cred
                    break
            if user_cred:
                cred_svc.update_credential(cred_id=user_cred["id"], password=new_password)
                return True
            else:
                cred_svc.create_credential(
                    name=f"{username} User Account",
                    username=username,
                    cred_type="generic",
                    password=new_password,
                    valid_until=None,
                )
                return True
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Error updating password for %s: %s", username, e)
            return False

    def delete_user_profile(self, username: str) -> bool:
        try:
            return self.profile_repo.delete_by_username(username)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Error deleting profile for %s: %s", username, e)
            return False
