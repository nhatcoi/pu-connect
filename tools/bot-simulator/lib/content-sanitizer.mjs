// Làm sạch văn bản AI viết lại: bỏ link Facebook, che thông tin liên hệ cá nhân
const FB_LINK = /https?:\/\/(?:[\w-]+\.)?(?:facebook\.com|fb\.com|fb\.me|fb\.watch|messenger\.com)\S*/gi
const PHONE = /(?:\+?84|0)[\s.-]?\d{2,3}[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g

export const sanitizeContent = (text) =>
  String(text ?? '')
    .replace(FB_LINK, '')
    .replace(EMAIL, '')
    .replace(PHONE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
