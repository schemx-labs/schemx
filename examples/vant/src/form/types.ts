/** 合并表单示例使用的表单值与数组项类型。 */

export type MemberRole = "designer" | "developer" | "tester"

export interface DynamicArrayMember {
  name: string
  role: MemberRole
  enabled: boolean
}

export interface FormGroupsValues {
  test: string
  test1: string
  test2: string
  basic: {
    username: string
    website: string
    phone: string
    bio: string
    age: number
    notification: boolean
    gender: "male" | "female"
    hobbies: string[]
    birthday?: string
    travelDate?: string
    city?: string
    frequentCampus?: string
    affiliatedCampus?: string
    preferredCities: string[]
    education?: string
    satisfaction?: number
    volume?: number
    quantity?: number
    avatar: Array<{ name: string; url?: string }>
    region: string[]
  }
  dynamic: {
    showDeliveryDetails: boolean
    deliveryMethod: "express" | "selfPickup" | "other"
    province?: string
    city?: string
    distance?: number
    quantity?: number
    remark?: string
    serviceRating?: number
  }
  dependency: {
    orderType: "standard" | "express"
    showConfiguration: boolean
    orderAccess: "edit" | "review" | "locked"
    quantity?: number
    expectedDate?: string
    deliveryMode?: "courier" | "pickup"
    pickupStore?: string
    pickupCode?: string
    expressLevel?: "priority" | "same_day" | "concierge"
    expressFee?: number
    serviceRating?: number
  }
  dynamicArray: {
    showMembers: boolean
    memberAccess: "edit" | "readonly" | "disabled"
    members: DynamicArrayMember[]
  }
}
