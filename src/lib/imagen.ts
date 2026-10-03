import type { Complejo } from '../config/complejos'
import { claveTurno, type MapaTurnos } from './turnos'
import { etiquetaRelativa, fechaLarga } from './fechas'
import { logoImagenUrl } from './marca'

export interface ContactoImagen {
  nombre: string
  telefono: string
}

// Imagen vertical pensada para WhatsApp (estado o chat)
const ANCHO = 1080
const ALTO = 1700

const C = {
  pelota: '#D2DA1F',
  blanco: '#FFFFFF',
}

const FUENTE = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif'

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = mal
    img.src = src
  })
}

async function prepararFuentes() {
  try {
    await Promise.all([
      document.fonts.load(`800 100px "Barlow Condensed"`),
      document.fonts.load(`700 60px "Barlow Condensed"`),
      document.fonts.load(`600 30px "Barlow Condensed"`),
      document.fonts.load(`600 44px "Barlow"`),
    ])
  } catch {
    /* si no cargan, se usa la fuente de respaldo */
  }
}

// Random con semilla: la textura sale igual en cada generación
function aleatorio(semilla: number) {
  let s = semilla
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function texto(
  ctx: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  tam: number,
  peso = 800,
  color = C.blanco,
  alinear: CanvasTextAlign = 'center',
  sombra = true,
) {
  ctx.save()
  ctx.font = `${peso} ${tam}px ${FUENTE}`
  ctx.textAlign = alinear
  ctx.textBaseline = 'middle'
  if (sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = tam * 0.12
    ctx.shadowOffsetY = tam * 0.04
  }
  ctx.fillStyle = color
  ctx.fillText(t, x, y)
  ctx.restore()
}

function anchoTexto(ctx: CanvasRenderingContext2D, t: string, tam: number, peso = 800) {
  ctx.save()
  ctx.font = `${peso} ${tam}px ${FUENTE}`
  const w = ctx.measureText(t).width
  ctx.restore()
  return w
}

/** Achica la fuente hasta que el texto entre en el ancho disponible */
function tamQueEntra(ctx: CanvasRenderingContext2D, t: string, tamMax: number, anchoMax: number, peso = 800) {
  let tam = tamMax
  while (tam > 12 && anchoTexto(ctx, t, tam, peso) > anchoMax) tam -= 2
  return tam
}

function pelota(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = r * 0.4
  ctx.shadowOffsetY = r * 0.12
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r)
  g.addColorStop(0, '#F4F87A')
  g.addColorStop(0.6, '#D2DA1F')
  g.addColorStop(1, '#9CA60F')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  // costuras
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = r * 0.12
  ctx.beginPath()
  ctx.arc(cx - r * 1.05, cy, r * 0.78, -Math.PI / 3.2, Math.PI / 3.2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + r * 1.05, cy, r * 0.78, Math.PI - Math.PI / 3.2, Math.PI + Math.PI / 3.2)
  ctx.stroke()
  ctx.restore()
}


// ---------------------------------------------------------------------
// Estilo Complejo PM: claro, blanco y negro como el logo, con pelotitas en los turnos reservados
// ---------------------------------------------------------------------
const P = {
  fondo: '#F3F1EC',     // hueso
  tinta: '#141414',     // negro
  gris: '#7A7A76',
  linea: '#D9D6CF',
  tarjeta: '#FFFFFF',
}
const SANS = '"Barlow", "Helvetica Neue", Arial, sans-serif'

/** Texto en Barlow con letras espaciadas */
function espaciado(ctx: CanvasRenderingContext2D, t: string, cx: number, y: number, tam: number, sep: number, color: string, peso = 600) {
  ctx.save()
  ctx.font = `${peso} ${tam}px ${SANS}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = color
  const anchos = [...t].map((ch) => ctx.measureText(ch).width)
  const total = anchos.reduce((a, b) => a + b, 0) + sep * (anchos.length - 1)
  let x = cx - total / 2
  ;[...t].forEach((ch, i) => {
    ctx.fillText(ch, x, y)
    x += anchos[i] + sep
  })
  ctx.restore()
  return total
}

function fondoPM(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = P.fondo
  ctx.fillRect(0, 0, ANCHO, ALTO)

  // textura de papel, muy suave (con semilla: sale igual siempre)
  const r = aleatorio(20261006)
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() < 0.6 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.5)'
    ctx.fillRect(r() * ANCHO, r() * ALTO, 1 + r() * 1.5, 1 + r() * 1.5)
  }

  // líneas de cancha de fondo, apenas marcadas
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.045)'
  ctx.lineWidth = 6
  const cx = ANCHO / 2
  const w = 760
  const h = 1520
  const y0 = (ALTO - h) / 2
  ctx.strokeRect(cx - w / 2, y0, w, h)
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, ALTO / 2); ctx.lineTo(cx + w / 2, ALTO / 2)
  ctx.moveTo(cx - w / 2, y0 + h * 0.15); ctx.lineTo(cx + w / 2, y0 + h * 0.15)
  ctx.moveTo(cx - w / 2, y0 + h * 0.85); ctx.lineTo(cx + w / 2, y0 + h * 0.85)
  ctx.moveTo(cx, y0 + h * 0.15); ctx.lineTo(cx, y0 + h * 0.85)
  ctx.stroke()
  ctx.restore()

  // marco negro doble y franjas negras arriba y abajo
  ctx.fillStyle = P.tinta
  ctx.fillRect(0, 0, ANCHO, 14)
  ctx.fillRect(0, ALTO - 14, ANCHO, 14)
  ctx.strokeStyle = P.tinta
  ctx.lineWidth = 3
  ctx.strokeRect(34, 40, ANCHO - 68, ALTO - 80)
  ctx.lineWidth = 1
  ctx.strokeRect(44, 50, ANCHO - 88, ALTO - 100)
}

function tituloPM(ctx: CanvasRenderingContext2D, fecha: string, logo: HTMLImageElement | null) {
  if (logo) {
    const ancho = 500
    const alto = (logo.height / logo.width) * ancho
    ctx.drawImage(logo, (ANCHO - ancho) / 2, 222 - alto / 2, ancho, alto)
  } else {
    espaciado(ctx, 'COMPLEJO PM', ANCHO / 2, 200, 96, 8, P.tinta, 600)
  }

  // ——  TURNOS LIBRES  ——
  const y = 420
  const w = espaciado(ctx, 'TURNOS LIBRES', ANCHO / 2, y, 44, 16, P.tinta, 600)
  ctx.fillStyle = P.tinta
  ctx.fillRect(ANCHO / 2 - w / 2 - 110, y - 1, 80, 2)
  ctx.fillRect(ANCHO / 2 + w / 2 + 30, y - 1, 80, 2)

  // fecha en una píldora negra
  const etiqueta = etiquetaRelativa(fecha)
  const t = `${etiqueta ? `${etiqueta} · ` : ''}${fechaLarga(fecha).toUpperCase()}`
  ctx.save()
  ctx.font = `600 30px ${SANS}`
  const ancho = [...t].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + 5 * (t.length - 1) + 64
  ctx.restore()
  ctx.fillStyle = P.tinta
  ctx.beginPath()
  ctx.roundRect(ANCHO / 2 - ancho / 2, 468, ancho, 60, 30)
  ctx.fill()
  espaciado(ctx, t, ANCHO / 2, 499, 30, 5, C.pelota, 600)
}

function columnasPM(ctx: CanvasRenderingContext2D, c: Complejo, turnos: MapaTurnos, top: number, alto: number) {
  const n = c.canchas.length
  const margen = 70
  const sep = 26
  const anchoCol = (ANCHO - margen * 2 - sep * (n - 1)) / n
  const altoCab = 104
  const paso = Math.min(84, (alto - altoCab - 24) / c.horarios.length)
  const tamHora = Math.min(...c.horarios.map((h) => tamQueEntra(ctx, `${h} HS`, paso * 0.74, anchoCol - 40, 700)))
  const altoCol = altoCab + paso * c.horarios.length + 24

  c.canchas.forEach((cancha, i) => {
    const x = margen + i * (anchoCol + sep)
    const cx = x + anchoCol / 2

    // tarjeta blanca con sombra suave
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.10)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 4
    ctx.fillStyle = P.tarjeta
    ctx.beginPath()
    ctx.roundRect(x, top, anchoCol, altoCol, 24)
    ctx.fill()
    ctx.restore()
    ctx.strokeStyle = P.tinta
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(x, top, anchoCol, altoCol, 24)
    ctx.stroke()

    // cabecera negra
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(x, top, anchoCol, altoCab - 14, [24, 24, 0, 0])
    ctx.fillStyle = P.tinta
    ctx.fill()
    ctx.restore()
    const nombre = cancha.toUpperCase()
    texto(ctx, nombre, cx, top + (altoCab - 14) / 2 + 2, tamQueEntra(ctx, nombre, 62, anchoCol - 40), 800, '#FFFFFF', 'center', false)

    c.horarios.forEach((h, j) => {
      const y = top + altoCab + 4 + paso * j + paso / 2
      if (j > 0) {
        ctx.fillStyle = P.linea
        ctx.fillRect(x + 28, y - paso / 2, anchoCol - 56, 1.5)
      }
      const reservada = turnos[claveTurno(cancha, h)]?.estado === 'reservada'
      texto(ctx, `${h} HS`, cx, y + 2, tamHora, 700, reservada ? 'rgba(20,20,20,0.28)' : P.tinta, 'center', false)
      if (reservada) pelota(ctx, cx, y, paso * 0.36)
    })
  })
}

/** Contactos en grilla de 2 columnas (4 → 2×2, 3 → 2 + 1 centrado) */
function piePM(ctx: CanvasRenderingContext2D, lista: ContactoImagen[], top: number) {
  if (!lista.length) return
  const w = espaciado(ctx, 'RESERVAS', ANCHO / 2, top, 30, 12, P.gris, 600)
  ctx.fillStyle = P.gris
  ctx.fillRect(ANCHO / 2 - w / 2 - 80, top - 1, 56, 2)
  ctx.fillRect(ANCHO / 2 + w / 2 + 24, top - 1, 56, 2)
  const filas: ContactoImagen[][] = []
  for (let i = 0; i < lista.length; i += 2) filas.push(lista.slice(i, i + 2))
  filas.forEach((fila, k) => {
    const y = top + 66 + 104 * k
    fila.forEach((ct, j) => {
      const x = fila.length === 1 ? ANCHO / 2 : j === 0 ? ANCHO * 0.29 : ANCHO * 0.71
      espaciado(ctx, ct.nombre.toUpperCase(), x, y, 24, 6, P.gris, 600)
      texto(ctx, ct.telefono, x, y + 42, tamQueEntra(ctx, ct.telefono, 50, 420, 700), 700, P.tinta, 'center', false)
    })
  })
}

function dibujarPM(ctx: CanvasRenderingContext2D, c: Complejo, fecha: string, turnos: MapaTurnos, logo: HTMLImageElement | null, contactos: ContactoImagen[]) {
  fondoPM(ctx)
  tituloPM(ctx, fecha, logo)
  const filasPie = Math.ceil(contactos.length / 2)
  const altoPie = contactos.length ? 66 + 104 * filasPie + 30 : 0
  const top = 566
  const finColumnas = ALTO - 90 - altoPie
  columnasPM(ctx, c, turnos, top, finColumnas - top - 20)
  piePM(ctx, contactos, finColumnas + 30)
  ctx.save()
  ctx.globalAlpha = 0.7
  texto(ctx, '🎾 Desarrollado por Federico Olego 🎾', ANCHO / 2, ALTO - 72, 24, 600, P.gris, 'center', false)
  ctx.restore()
}

export async function generarImagen(c: Complejo, fecha: string, turnos: MapaTurnos, contactos: ContactoImagen[]): Promise<Blob> {
  await prepararFuentes()
  const logo = await cargarImagen(logoImagenUrl()).catch(() => null)
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO
  canvas.height = ALTO
  const ctx = canvas.getContext('2d')!
  dibujarPM(ctx, c, fecha, turnos, logo, contactos)
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo generar la imagen'))), 'image/png'))
}

export const nombreArchivo = (c: Complejo, fecha: string) => `turnos-${c.id}-${fecha}.png`