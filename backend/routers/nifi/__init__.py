"""NiFi routers - exports all sub-routers for registration in main.py."""

from routers.nifi.instances import router as instances_router
from routers.nifi.operations import router as operations_router
from routers.nifi.deploy import router as deploy_router
from routers.nifi.nifi_flows import router as nifi_flows_router
from routers.nifi.flow_views import router as flow_views_router
from routers.nifi.registry_flows import router as registry_flows_router
from routers.nifi.hierarchy import router as hierarchy_router
from routers.nifi.certificates import router as certificates_router
from routers.nifi.install import router as install_router

__all__ = [
    "instances_router",
    "operations_router",
    "deploy_router",
    "nifi_flows_router",
    "flow_views_router",
    "registry_flows_router",
    "hierarchy_router",
    "certificates_router",
    "install_router",
]
