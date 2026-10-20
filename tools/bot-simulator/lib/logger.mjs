const time = () => new Date().toLocaleTimeString('vi-VN', { hour12: false })

let sink = null

// sink({ level, action, bot, details }) — ghi nhật ký hoạt động vào DB cho Admin xem
const emit = (level, line, entry) => {
  const out = level === 'error' ? console.error : console.log
  out(`[${time()}] ${line}`)
  if (entry) sink?.({ level, ...entry })
}

export const logger = {
  setSink(fn) {
    sink = fn
  },
  info: (msg, meta = '') => emit('info', `INFO  ${msg} ${meta}`.trim()),
  success: (msg, meta = '') => emit('info', `OK    ${msg} ${meta}`.trim()),
  warn: (msg, meta = '') => emit('warn', `WARN  ${msg} ${meta}`.trim(), { action: 'warn', bot: null, details: `${msg} ${meta}`.trim() }),
  error: (msg, err = '') => {
    const detail = `${msg} ${err?.message || err}`.trim()
    emit('error', `ERROR ${detail}`, { action: 'error', bot: null, details: detail })
  },
  action: (bot, type, details) => emit('info', `${type.toUpperCase()} @${bot}: ${details}`, { action: type, bot, details })
}
