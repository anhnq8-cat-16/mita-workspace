function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}. Xem .env.example`)
  }
  return value
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY),
  /** Domain Google Workspace, truyền vào tham số `hd` khi đăng nhập */
  googleHostedDomain: import.meta.env.VITE_GOOGLE_HD ?? '',
}
