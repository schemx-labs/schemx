/** 合并表单示例使用的静态选项。 */

export const genderOptions = [
  { label: "男", value: "male" },
  { label: "女", value: "female" },
]

export const hobbyOptions = [
  { label: "阅读", value: "reading" },
  { label: "运动", value: "sports" },
  { label: "音乐", value: "music" },
  { label: "旅行", value: "travel" },
]

export const cityOptions = [
  { text: "北京", value: "beijing" },
  { text: "上海", value: "shanghai" },
  { text: "广州", value: "guangzhou" },
  { text: "深圳", value: "shenzhen" },
  { text: "杭州", value: "hangzhou" },
]

export const campusOptions = [
  { text: "高新校区", value: "high-tech" },
  { text: "临江校区", value: "riverside" },
  { text: "大学城校区", value: "university-town" },
]

export const educationOptions = [
  { label: "高中", value: "high_school" },
  { label: "大专", value: "college" },
  { label: "本科", value: "bachelor" },
  { label: "硕士", value: "master" },
  { label: "博士", value: "doctor" },
]

export const deliveryMethodOptions = [
  { label: "快递配送", value: "express" },
  { label: "门店自提", value: "selfPickup" },
  { label: "其他方式", value: "other" },
]

export const deliveryProvinceOptions = [
  { text: "浙江省", value: "zhejiang" },
  { text: "广东省", value: "guangdong" },
  { text: "北京市", value: "beijing" },
]

export const orderTypeOptions = [
  { label: "标准订单", value: "standard" },
  { label: "加急订单", value: "express" },
]

export const orderAccessOptions = [
  { label: "可编辑", value: "edit" },
  { label: "仅查看", value: "review" },
  { label: "已锁定", value: "locked" },
]

export const deliveryModeOptions = [
  { label: "快递配送", value: "courier" },
  { label: "门店自提", value: "pickup" },
]

export const expressLevelOptions = [
  { label: "优先处理", value: "priority" },
  { label: "当日达", value: "same_day" },
  { label: "专人跟进", value: "concierge" },
]

export const memberRoleOptions = [
  { label: "开发", value: "developer" },
  { label: "设计", value: "designer" },
  { label: "测试", value: "tester" },
]

export const memberAccessOptions = [
  { label: "可编辑", value: "edit" },
  { label: "只读", value: "readonly" },
  { label: "禁用", value: "disabled" },
]

export const pickupStoreOptions = [
  { label: "湖滨银泰店", value: "hubin" },
  { label: "万象城店", value: "mixc" },
]

export const regionOptions = [
  {
    label: "浙江省",
    value: "zhejiang",
    children: [
      {
        label: "杭州市",
        value: "hangzhou",
        children: [
          { label: "西湖区", value: "xihu" },
          { label: "余杭区", value: "yuhang" },
        ],
      },
      {
        label: "宁波市",
        value: "ningbo",
        children: [
          { label: "海曙区", value: "haishu" },
          { label: "江北区", value: "jiangbei" },
        ],
      },
    ],
  },
  {
    label: "江苏省",
    value: "jiangsu",
    children: [
      {
        label: "南京市",
        value: "nanjing",
        children: [
          { label: "玄武区", value: "xuanwu" },
          { label: "鼓楼区", value: "gulou" },
        ],
      },
      {
        label: "苏州市",
        value: "suzhou",
        children: [
          { label: "姑苏区", value: "gusu" },
          { label: "工业园区", value: "industrial_park" },
        ],
      },
    ],
  },
]
