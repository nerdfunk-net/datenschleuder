"""NiFi flow repository — superseded by raw SQL in nifi_flow_service.

The nifi_flows table is dynamically structured (columns depend on hierarchy),
so the ORM-based repository pattern does not apply here.  All flow data access
is handled directly in services/nifi/nifi_flow_service.py via SQLAlchemy core.
"""
