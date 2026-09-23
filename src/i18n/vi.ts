import type { LeaveType, Role } from '@/lib/database.types'
import type { NavKey } from '@/lib/nav'

/** Toàn bộ chuỗi giao diện tiếng Việt */
export const vi = {
  appName: 'Mita Workspace',
  company: 'MITAFOOD',

  common: {
    save: 'Lưu',
    saving: 'Đang lưu…',
    cancel: 'Hủy',
    close: 'Đóng',
    delete: 'Xóa',
    edit: 'Sửa',
    add: 'Thêm',
    loading: 'Đang tải…',
    error: 'Đã có lỗi xảy ra',
    retry: 'Thử lại',
    yes: 'Có',
    no: 'Không',
    search: 'Tìm kiếm',
    more: 'Thêm',
    empty: 'Chưa có dữ liệu',
    saved: 'Đã lưu',
    comingSoon: 'Tính năng đang được xây dựng',
    comingSoonMilestone: (m: string) => `Sẽ có ở giai đoạn ${m}.`,
    noPermission: 'Bạn không có quyền truy cập trang này.',
    backHome: 'Về trang Hôm nay',
  },

  nav: {
    today: 'Hôm nay',
    tasks: 'Công việc',
    goals: 'Mục tiêu tuần',
    sales: 'Lead & khách',
    checkin: 'Check-in',
    library: 'Thư viện',
    products: 'Sản phẩm',
    reports: 'Báo cáo',
    dashboard: 'Quản lý',
    settings: 'Cài đặt',
  } satisfies Record<NavKey, string>,

  navShort: {
    today: 'Hôm nay',
    tasks: 'Việc',
    goals: 'Mục tiêu',
    sales: 'Khách',
    checkin: 'Check-in',
    library: 'Thư viện',
    products: 'Sản phẩm',
    reports: 'Báo cáo',
    dashboard: 'Quản lý',
    settings: 'Cài đặt',
  } satisfies Record<NavKey, string>,

  roles: {
    admin: 'Quản trị',
    manager: 'Quản lý',
    lead: 'Trưởng nhóm',
    staff: 'Nhân viên',
  } satisfies Record<Role, string>,

  teams: {
    sales_domestic: 'Sale nội địa',
    marketing: 'Marketing',
    export: 'Xuất khẩu',
  } as Record<string, string>,

  leaveTypes: {
    nghi_phep: 'Nghỉ phép',
    cong_tac: 'Công tác',
    om: 'Ốm',
    khac: 'Khác',
  } satisfies Record<LeaveType, string>,

  auth: {
    loginTitle: 'Đăng nhập',
    loginSubtitle: 'Cổng làm việc nội bộ MITAFOOD',
    loginWithGoogle: 'Đăng nhập bằng Google',
    loginHint: (domain: string) =>
      domain ? `Chỉ dùng tài khoản công ty @${domain}` : 'Chỉ dùng tài khoản Google của công ty',
    signingIn: 'Đang đăng nhập…',
    logout: 'Đăng xuất',
    wrongDomain: 'Chỉ tài khoản Google của công ty mới được đăng nhập.',
    callbackError: 'Đăng nhập không thành công',
    pendingTitle: 'Tài khoản đang chờ quản trị kích hoạt',
    pendingBody:
      'Bạn đã đăng nhập thành công nhưng tài khoản chưa được kích hoạt. Hãy báo quản trị (anh Quý Anh) để được cấp quyền, sau đó bấm "Kiểm tra lại".',
    lockedTitle: 'Tài khoản đã bị khóa',
    lockedBody: 'Tài khoản của bạn đang bị khóa. Liên hệ quản trị nếu cần mở lại.',
    checkAgain: 'Kiểm tra lại',
    signedInAs: 'Đang đăng nhập:',
  },

  notifications: {
    title: 'Thông báo',
    empty: 'Không có thông báo mới',
    markAllRead: 'Đánh dấu đã đọc tất cả',
  },

  home: {
    greeting: (name: string) => `Xin chào, ${name}!`,
    todayIs: (weekday: string, date: string) => `${weekday}, ${date}`,
    notWorkday: 'Hôm nay không phải ngày làm việc.',
    foundationReady:
      'Nền tảng đã sẵn sàng. Kế hoạch ngày và báo cáo cuối ngày sẽ có ở giai đoạn M1.',
    yourTeams: 'Team của bạn',
    yourRole: 'Vai trò',
  },

  settings: {
    title: 'Cài đặt hệ thống',
    tabs: {
      users: 'Người dùng',
      general: 'Thông số',
    },
    users: {
      title: 'Người dùng',
      invite: 'Mời người dùng',
      inviteHint:
        'Nhập email công ty. Người được mời đăng nhập Google lần đầu sẽ được kích hoạt ngay với vai trò và team đã chọn.',
      email: 'Email',
      fullName: 'Họ tên',
      role: 'Vai trò',
      teams: 'Team',
      leadOf: 'Trưởng nhóm',
      titleField: 'Chức danh',
      active: 'Đang hoạt động',
      pending: 'Chờ kích hoạt',
      locked: 'Đã khóa',
      activate: 'Kích hoạt',
      lock: 'Khóa',
      unlock: 'Mở khóa',
      invited: 'Đã gửi lời mời',
      pendingInvites: 'Lời mời chưa đăng nhập',
      revokeInvite: 'Hủy lời mời',
      confirmLock: (name: string) =>
        `Khóa tài khoản ${name}? Người này sẽ không dùng được hệ thống.`,
      confirmRevoke: (email: string) => `Hủy lời mời ${email}?`,
      emailInvalid: 'Email không hợp lệ',
      emailWrongDomain: (domain: string) => `Email phải thuộc domain @${domain}`,
      teamsRequired: 'Chọn ít nhất 1 team',
      noUsers: 'Chưa có người dùng',
      you: '(bạn)',
      leadToggleHint: 'Bấm ★ để đặt/bỏ trưởng nhóm của team',
      filterAll: 'Tất cả',
    },
    general: {
      title: 'Thông số hệ thống',
      hint: 'Giá trị dạng JSON. Giờ ghi dạng "09:00", danh sách dạng ["a","b"].',
      invalidJson: 'Giá trị không phải JSON hợp lệ',
      lastUpdated: (when: string) => `Cập nhật: ${when}`,
    },
  },

  errors: {
    lastAdmin: 'Không thể khóa hoặc hạ quyền quản trị viên cuối cùng',
    permission: 'Bạn không có quyền thực hiện thao tác này',
    network: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
  },
} as const
