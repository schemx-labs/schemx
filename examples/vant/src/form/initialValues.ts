import type { FormGroupsValues } from "./types"

/** 创建合并表单示例的初始值，避免多个组件实例共享可变对象。 */
export function createInitialFormData(): FormGroupsValues {
  return {
    basic: {
      username: "张三",
      website: "www.example.com",
      phone: "13812348899",
      bio: "这是一个基础表单示例。",
      age: 25,
      notification: true,
      gender: "male",
      hobbies: ["reading"],
      birthday: "",
      travelDate: "",
      city: "hangzhou",
      frequentCampus: "high-tech",
      affiliatedCampus: "riverside",
      preferredCities: ["hangzhou"],
      education: "bachelor",
      satisfaction: 4,
      volume: 60,
      quantity: 1,
      avatar: [],
      region: [],
    },
    dynamic: {
      showDeliveryDetails: true,
      deliveryMethod: "express",
      province: "zhejiang",
      city: "hangzhou",
      distance: 12,
      quantity: 1,
      remark: "",
      serviceRating: 4,
    },
    dependency: {
      orderType: "standard",
      showConfiguration: true,
      orderAccess: "edit",
      quantity: 1,
      expectedDate: "",
      deliveryMode: "courier",
      pickupStore: "",
      pickupCode: "",
      expressLevel: "priority",
      expressFee: 100,
      serviceRating: 4,
    },
    dynamicArray: {
      showMembers: true,
      memberAccess: "edit",
      members: [
        { name: "林默", role: "developer", enabled: true },
        { name: "周宁", role: "designer", enabled: true },
      ],
    },
  }
}
