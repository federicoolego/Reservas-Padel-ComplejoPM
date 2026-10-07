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

const HORARIOS = ['14:00', '15:30', '17:00', '18:30', '20:00', '21:30', '23:00']

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
