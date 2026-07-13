/**
 * WhatsApp message templates for service job updates.
 * Ported 1:1 from the vanilla JS PWA's `sendWAMsg()` function.
 *
 * Each template returns a fully-formatted WhatsApp message body that gets
 * URL-encoded and opened via https://wa.me/<phone>?text=<msg>.
 *
 * Templates:
 *   - received   →  acknowledge device received, ask for confirmation
 *   - progress   →  repair in-progress checklist
 *   - completed  →  job done, ready for pickup, balance + UPI
 *   - payment    →  balance reminder with UPI ID
 *   - delivered  →  thank-you note after delivery
 */

export interface WhatsAppJobData {
  id: string
  customerName: string
  customerMobile: string
  deviceType: string
  brandModel?: string
  problemDesc: string
  accessories?: string
  date: string
  estimatedAmount: number
  advanceAmount: number
  paidAmount: number
  finalAmount: number
  serviceCharge: number
  spareParts?: Array<{ name: string; qty: number; total: number; sellPrice?: number; price?: number }>
}

export interface WhatsAppShopInfo {
  businessName: string
  businessMobile: string
  businessAddress?: string
  whatsappNumber?: string
  upiId?: string
}

export type WhatsAppTemplateType = 'received' | 'progress' | 'completed' | 'payment' | 'delivered'

export const WHATSAPP_TEMPLATES: Array<{ type: WhatsAppTemplateType; title: string; desc: string; icon: string; color: string }> = [
  { type: 'received',  title: 'Device Received',    desc: 'Confirm with cost estimate', icon: 'fa-inbox',                color: 'blue'   },
  { type: 'progress',  title: 'In Progress',         desc: 'Repair ongoing update',     icon: 'fa-wrench',               color: 'amber'  },
  { type: 'completed', title: 'Completed',           desc: 'Ready for pickup',          icon: 'fa-check',                color: 'green'  },
  { type: 'payment',   title: 'Payment Reminder',    desc: 'Balance with UPI',          icon: 'fa-indian-rupee-sign',    color: 'purple' },
  { type: 'delivered', title: 'Thank You',           desc: 'After delivery',            icon: 'fa-handshake',            color: 'gray'   },
]

export function buildWhatsAppMessage(
  type: WhatsAppTemplateType,
  job: WhatsAppJobData,
  shop: WhatsAppShopInfo,
): string {
  const bn = shop.businessName || 'Smart Computers'
  const tot = job.finalAmount || job.estimatedAmount || 0
  const paid = (job.paidAmount || 0) + (job.advanceAmount || 0)
  const bal = tot - paid
  const svc = job.serviceCharge || 0
  const pt = (job.spareParts || []).reduce((s, p) => s + (p.total || 0), 0)
  const jobDate = new Date(job.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  switch (type) {
    case 'received':
      return `*${bn}*\n\n✅ *DEVICE RECEIVED*\n\nDear *${job.customerName}*,\n\nYour device has been received.\n\n📋 *Job No:* ${job.id}\n📅 *Date:* ${jobDate}\n\n📱 *Device:* ${job.deviceType}${job.brandModel ? ' - ' + job.brandModel : ''}\n🔍 *Issue:* ${job.problemDesc}\n📦 *Accessories:* ${job.accessories || 'None'}\n\n💰 *ESTIMATED COST*\n🔩 Parts: ₹${pt || 'TBD'}\n🔧 Service: ₹${svc || 'TBD'}\n━━━━━━\n📊 *Estimate: ₹${tot > 0 ? tot : 'Will confirm after diagnosis'}*\n${job.advanceAmount > 0 ? `✅ Advance: ₹${job.advanceAmount}\n` : ''}\n⏳ *WAITING FOR YOUR CONFIRMATION*\nReply:\n✅ *YES* - Proceed\n❌ *NO* - Hold/Cancel\n\n📞 ${shop.businessMobile || ''}\n📍 ${shop.businessAddress || ''}\n\nThank you! 🙏`

    case 'progress':
      return `*${bn}*\n\n🔧 *WORK IN PROGRESS*\n\nDear *${job.customerName}*,\n\nYour device repair is in progress.\n\n📋 *Job No:* ${job.id}\n📱 *Device:* ${job.deviceType}\n\n📊 *Progress:*\n✅ Received\n✅ Diagnosis Done\n🔄 *Repair In Progress*\n⏳ Testing\n⏳ Ready\n\n💰 *ESTIMATED COST*\n🔩 Parts: ₹${pt || 0}\n🔧 Service: ₹${svc || 0}\n━━━━━━\n📊 *Estimate: ₹${tot}*\n${job.advanceAmount > 0 ? `✅ Advance: -₹${job.advanceAmount}\n💵 Balance: ₹${tot - job.advanceAmount}\n` : ''}\n⏰ Expected: 24-48 hours\n\n📞 ${shop.businessMobile || ''}\nThank you! 🙏`

    case 'completed':
      return `*${bn}*\n\n🎉 *REPAIR COMPLETED!*\n\n${job.customerName}, your device is ready!\n\n📋 *Job:* ${job.id}\n🔧 ${job.deviceType}${job.brandModel ? ' - ' + job.brandModel : ''}\n\n💰 *Bill:*\n${(job.spareParts || []).map((p) => `• ${p.name} x${p.qty} = ₹${p.total}`).join('\n')}\n🔧 Service: ₹${svc}\n━━━━━━\n*Total: ₹${tot}*\n${bal !== tot ? `Paid: -₹${tot - bal}\n` : ''}*Balance: ${bal > 0 ? '₹' + bal : 'PAID ✅'}*${shop.upiId && bal > 0 ? `\n\n📲 UPI: ${shop.upiId}` : ''}\n\n📍 ${shop.businessAddress || ''}\n📞 ${shop.businessMobile || ''}\n🕐 Mon-Sat: 10AM-8PM\n\nThank you! 🙏`

    case 'payment':
      return `*${bn}*\n\n💳 *PAYMENT REMINDER*\n\n${job.customerName},\n\n📋 Job: ${job.id}\n*Total:* ₹${tot}\n*Paid:* ₹${paid}\n*Balance:* ₹${bal}${shop.upiId ? `\n\n📲 UPI: ${shop.upiId}` : ''}\n\n📞 ${shop.businessMobile || ''}\nThank you! 🙏`

    case 'delivered':
      return `*${bn}*\n\n🤝 *THANK YOU!*\n\n${job.customerName}, your ${job.deviceType} delivered.\n\n📋 Job: ${job.id}\n\n⭐ Please recommend us!\n📞 ${shop.businessMobile || ''}\n\nSee you again! 🙏`
  }
}

/**
 * Generate a wa.me link that opens WhatsApp with a prefilled message.
 * Accepts 10-digit Indian mobile (auto-prefix 91) or full international number.
 */
export function buildWhatsAppLink(mobile: string, message: string): string {
  const digits = String(mobile || '').replace(/\D/g, '')
  const phone = digits.length === 10 ? '91' + digits : digits
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
