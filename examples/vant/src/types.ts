/**
 * vant 表单值类型定义
 *
 * 集中管理各示例表单的值类型，供 SchemxField<T> 泛型和事件回调使用。
 *
 * @module types
 */

/**
 * 基础表单值类型
 */
export interface BasicFormValues {
  username?: string
  phone?: string
  website?: string
  bio?: string
  age?: number
  notification?: boolean
  gender?: string
  hobbies?: string[]
  birthday?: string
  travelDate?: string
  city?: string
  education?: string
  satisfaction?: number
  volume?: number
  quantity?: number
  avatar?: any
  region?: string
  preferredCities?: string
}

/**
 * 动态表单值类型
 */
export interface DynamicFormValues {
  deliveryMethod?: "express" | "selfPickup" | "other"
  province?: string
  city?: string
  distance?: number
  quantity?: number
  remark?: string
  serviceRating?: number
}

/**
 * 字段联动表单值类型
 */
export interface DependencyFormValues {
  orderType?: "standard" | "express" | "custom"
  quantity?: number
  expectedDate?: string
  deliveryMode?: "courier" | "pickup"
  pickupStore?: string
  pickupCode?: string
  receiverPhone?: string
  shippingAddress?: string
  bulkReason?: string
  expressLevel?: "priority" | "same_day" | "concierge"
  expressFee?: number
  serviceRating?: number
  sameDayTime?: string
  sameDayContact?: string
  conciergeBudget?: number
  conciergeBrief?: string
  customCategory?: "gift" | "event" | "enterprise"
  address?: string
  giftMessage?: string
  eventDateRange?: string
  attendeeCount?: number
  companyName?: string
  approvalLevel?: "normal" | "legal"
  contractAttachment?: any
  additionalServices?: string[]
  invoiceAttachment?: any
  invoiceAmount?: number
  giftWrapStyle?: "business" | "festival" | "kids"
  festivalTheme?: string
  warrantyYears?: number
  warrantyContact?: string
}

/**
 * 验证表单值类型
 */
export interface ValidationFormValues {
  username?: string
  email?: string
  phone?: string
  password?: string
  confirmPassword?: string
  age?: number
  idCard?: string
  contactEmail?: string
}
