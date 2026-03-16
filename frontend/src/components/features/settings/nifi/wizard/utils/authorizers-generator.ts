/**
 * Generate authorizers.xml from node certificate subjects and admin subject.
 * Template based on contributing-data/nifi/authorizers.xml
 */
export function generateAuthorizersXml(
  nodeSubjects: string[],
  adminSubject: string
): string {
  const allIdentities = [...nodeSubjects, adminSubject]

  const userIdentityLines = allIdentities
    .map(
      (subject, i) =>
        `        <property name="Initial User Identity ${i + 1}">${escapeXml(subject)}</property>`
    )
    .join('\n')

  const nodeIdentityLines = nodeSubjects
    .map(
      (subject, i) =>
        `        <property name="Node Identity ${i + 1}">${escapeXml(subject)}</property>`
    )
    .join('\n')

  return `<authorizers>
    <userGroupProvider>
        <identifier>file-user-group-provider</identifier>
        <class>org.apache.nifi.authorization.FileUserGroupProvider</class>
        <property name="Users File">./conf/users.xml</property>
        <property name="Legacy Authorized Users File"></property>

        <!-- ALL identities must be listed here — nodes AND admin -->
${userIdentityLines}
    </userGroupProvider>

    <accessPolicyProvider>
        <identifier>file-access-policy-provider</identifier>
        <class>org.apache.nifi.authorization.FileAccessPolicyProvider</class>
        <property name="User Group Provider">file-user-group-provider</property>
        <property name="Authorizations File">./conf/authorizations.xml</property>
        <property name="Initial Admin Identity">${escapeXml(adminSubject)}</property>

        <!-- Must match Initial User Identity entries above exactly -->
${nodeIdentityLines}
    </accessPolicyProvider>

    <authorizer>
        <identifier>managed-authorizer</identifier>
        <class>org.apache.nifi.authorization.StandardManagedAuthorizer</class>
        <property name="Access Policy Provider">file-access-policy-provider</property>
    </authorizer>
</authorizers>
`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
