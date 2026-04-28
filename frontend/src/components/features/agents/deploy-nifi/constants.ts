import type { PropertyGroup } from './types'

export const DOCKER_COMPOSE_TEMPLATE = `  services:
    __SERVICE_NAME__:
        hostname: __HOSTNAME__
        image: __IMAGE__
        ports:
          - __DOCKER_PORT__:__DOCKER_PORT__
        environment:
          NIFI_WEB_HTTPS_PORT: __NIFI_WEB_HTTPS_PORT__
          AUTH: __AUTH__
          SINGLE_USER_CREDENTIALS_USERNAME: __SINGLE_USER_CREDENTIALS_USERNAME__
          SINGLE_USER_CREDENTIALS_PASSWORD: __SINGLE_USER_CREDENTIALS_PASSWORD__
          KEYSTORE_PATH: __KEYSTORE_PATH__
          KEYSTORE_TYPE: __KEYSTORE_TYPE__
          KEYSTORE_PASSWORD: __KEYSTORE_PASSWORD__
          TRUSTSTORE_PATH: __TRUSTSTORE_PATH__
          TRUSTSTORE_PASSWORD: __TRUSTSTORE_PASSWORD__
          TRUSTSTORE_TYPE: __TRUSTSTORE_TYPE__
          INITIAL_ADMIN_IDENTITY: __INITIAL_ADMIN_IDENTITY__
          LDAP_AUTHENTICATION_STRATEGY: __LDAP_AUTHENTICATION_STRATEGY__
          LDAP_MANAGER_DN: __LDAP_MANAGER_DN__
          LDAP_MANAGER_PASSWORD: __LDAP_MANAGER_PASSWORD__
          LDAP_USER_SEARCH_BASE: __LDAP_USER_SEARCH_BASE__
          LDAP_USER_SEARCH_FILTER: __LDAP_USER_SEARCH_FILTER__
          LDAP_IDENTITY_STRATEGY: __LDAP_IDENTITY_STRATEGY__
          LDAP_URL: __LDAP_URL__
          LDAP_TLS_KEYSTORE: __LDAP_TLS_KEYSTORE__
          LDAP_TLS_KEYSTORE_PASSWORD: __LDAP_TLS_KEYSTORE_PASSWORD__
          LDAP_TLS_KEYSTORE_TYPE: __LDAP_TLS_KEYSTORE_TYPE__
          LDAP_TLS_TRUSTSTORE: __LDAP_TLS_TRUSTSTORE__
          LDAP_TLS_TRUSTSTORE_PASSWORD: __LDAP_TLS_TRUSTSTORE_PASSWORD__
          LDAP_TLS_TRUSTSTORE_TYPE: __LDAP_TLS_TRUSTSTORE_TYPE__
          NIFI_CLUSTER_IS_NODE: __NIFI_CLUSTER_IS_NODE__
          NIFI_CLUSTER_ADDRESS: __NIFI_CLUSTER_ADDRESS__
          NIFI_CLUSTER_NODE_PROTOCOL_PORT: __NIFI_CLUSTER_NODE_PROTOCOL_PORT__
          NIFI_CLUSTER_NODE_PROTOCOL_MAX_THREADS: __NIFI_CLUSTER_NODE_PROTOCOL_MAX_THREADS__
          NIFI_ZK_CONNECT_STRING: __NIFI_ZK_CONNECT_STRING__
          NIFI_ZK_ROOT_NODE: __NIFI_ZK_ROOT_NODE__
          NIFI_ELECTION_MAX_WAIT: __NIFI_ELECTION_MAX_WAIT__
          NIFI_ELECTION_MAX_CANDIDATES: __NIFI_ELECTION_MAX_CANDIDATES__

        volumes:
          - .__SRC_CONF_DIR__:/opt/nifi/nifi-current/conf
          - .__SRC_DATABASE_DIR__:/opt/nifi/nifi-current/database_repository
          - .__SRC_FLOWFILE_DIR__:/opt/nifi/nifi-current/flowfile_repository
          - .__SRC_CONTENT_DIR__:/opt/nifi/nifi-current/content_repository
          - .__SRC_PROVENANCE_DIR__:/opt/nifi/nifi-current/provenance_repository
          - .__SRC_STATE_DIR__:/opt/nifi/nifi-current/state
          - .__SRC_LOGS_DIR__:/opt/nifi/nifi-current/logs
        networks:
            - __NETWORK_NAME__

networks:
  __NETWORK_NAME__:
    external: true
`

export const PROPERTY_GROUPS: PropertyGroup[] = [
  {
    title: 'Docker Service',
    properties: ['SERVICE_NAME', 'HOSTNAME', 'IMAGE', 'DOCKER_PORT', 'NETWORK_NAME'],
  },
  {
    title: 'NiFi Core',
    properties: [
      'NIFI_WEB_HTTPS_PORT',
      'AUTH',
      'SINGLE_USER_CREDENTIALS_USERNAME',
      'SINGLE_USER_CREDENTIALS_PASSWORD',
    ],
  },
  {
    title: 'PKI / TLS',
    properties: [
      'KEYSTORE_PATH',
      'KEYSTORE_TYPE',
      'KEYSTORE_PASSWORD',
      'TRUSTSTORE_PATH',
      'TRUSTSTORE_PASSWORD',
      'TRUSTSTORE_TYPE',
      'INITIAL_ADMIN_IDENTITY',
    ],
  },
  {
    title: 'LDAP',
    properties: [
      'LDAP_AUTHENTICATION_STRATEGY',
      'LDAP_MANAGER_DN',
      'LDAP_MANAGER_PASSWORD',
      'LDAP_USER_SEARCH_BASE',
      'LDAP_USER_SEARCH_FILTER',
      'LDAP_IDENTITY_STRATEGY',
      'LDAP_URL',
      'LDAP_TLS_KEYSTORE',
      'LDAP_TLS_KEYSTORE_PASSWORD',
      'LDAP_TLS_KEYSTORE_TYPE',
      'LDAP_TLS_TRUSTSTORE',
      'LDAP_TLS_TRUSTSTORE_PASSWORD',
      'LDAP_TLS_TRUSTSTORE_TYPE',
    ],
  },
  {
    title: 'Cluster',
    properties: [
      'NIFI_CLUSTER_IS_NODE',
      'NIFI_CLUSTER_ADDRESS',
      'NIFI_CLUSTER_NODE_PROTOCOL_PORT',
      'NIFI_CLUSTER_NODE_PROTOCOL_MAX_THREADS',
      'NIFI_ZK_CONNECT_STRING',
      'NIFI_ZK_ROOT_NODE',
      'NIFI_ELECTION_MAX_WAIT',
      'NIFI_ELECTION_MAX_CANDIDATES',
    ],
  },
  {
    title: 'Volume Directories',
    properties: [
      'SRC_CONF_DIR',
      'SRC_DATABASE_DIR',
      'SRC_FLOWFILE_DIR',
      'SRC_CONTENT_DIR',
      'SRC_PROVENANCE_DIR',
      'SRC_STATE_DIR',
      'SRC_LOGS_DIR',
    ],
  },
]

export const VOLUME_DIR_KEYS = [
  'SRC_CONF_DIR',
  'SRC_DATABASE_DIR',
  'SRC_FLOWFILE_DIR',
  'SRC_CONTENT_DIR',
  'SRC_PROVENANCE_DIR',
  'SRC_STATE_DIR',
  'SRC_LOGS_DIR',
]

export const ALL_PROPERTY_KEYS: string[] = PROPERTY_GROUPS.flatMap((g) => g.properties)

export const REQUIRED_PROPERTIES = ['SERVICE_NAME', 'IMAGE', 'DOCKER_PORT', 'NIFI_WEB_HTTPS_PORT']

export const INITIAL_PROPERTIES: Record<string, string> = Object.fromEntries(
  ALL_PROPERTY_KEYS.map((k) => [k, ''])
)
