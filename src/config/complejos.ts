// Configuración de complejos, canchas y horarios.
// Para sumar/renombrar una cancha o cambiar un horario, se edita solo este archivo.
// Los contactos de la imagen se editan desde la app (tabla reservas_complejopm_contactos).
// Si se agrega un complejo, sumar también su id al check "complejo in (...)" de las tablas en Supabase.

export type ComplejoId = 'complejopm'

export interface Complejo {
  id: ComplejoId
  nombre: string            // como se muestra en la app
  tituloImagen: string      // nombre del complejo en la imagen
  canchas: string[]         // el orden es el de las columnas
  horarios: string[]        // HH:MM
  estilo: 'bordo'           // diseño de la imagen
}

const HORARIOS = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00', '20:30', '22:00', '23:30']

export const COMPLEJOS: Complejo[] = [
  {
    id: 'complejopm',
    nombre: 'Complejo PM',
    tituloImagen: 'COMPLEJO PM',
    canchas: ['Cancha 1', 'Cancha 2'],
    horarios: HORARIOS,
    estilo: 'bordo',
  },
]

export const complejoPorId = (id: ComplejoId) => COMPLEJOS.find((c) => c.id === id)!
