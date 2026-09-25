/** Email ngoài domain công ty (vd Gmail) vẫn mời được – chỉ đúng email đó mới đăng nhập được */
export function isPersonalEmail(email: string, domains: string[]): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  return domains.length > 0 && domain !== '' && !domains.includes(domain)
}
