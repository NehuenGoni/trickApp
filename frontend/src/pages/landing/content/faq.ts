export interface LandingFaqItem {
  q: string;
  a: string;
}

export const FAQ: LandingFaqItem[] = [
  {
    q: '¿Tengo que registrar a todos los jugadores?',
    a: 'No. Los invitados juegan sin cuenta: los cargás con el nombre y listo. Podés mezclar invitados con usuarios registrados en el mismo torneo, y decidir si se sortean juntos o repartidos.'
  },
  {
    q: '¿Cuántos equipos entran en un torneo?',
    a: 'Los que tengas esa noche. Armás la llave con la cantidad de equipos que se anotaron, siempre con doble rama.'
  },
  {
    q: '¿Qué pasa si pierdo el primer partido?',
    a: 'Seguís jugando. El que pierde pasa a la rama plata y sigue compitiendo por los puestos de abajo. Nadie se vuelve a su casa después de un solo partido.'
  },
  {
    q: '¿Necesito internet en el bar?',
    a: 'Sí, TrickApp funciona online. Alcanza con los datos del celular para cargar los resultados; el proyector o la pantalla del local también necesita conexión.'
  },
  {
    q: '¿Se puede usar desde el celular?',
    a: 'Sí. Es una web que se instala como app en Android y iPhone, y el marcador está pensado para usarse con una mano mientras jugás.'
  },
  {
    q: '¿Cómo se paga?',
    a: 'En pesos, por MercadoPago, con suscripción mensual o anual. Los planes Club y Pro tienen precio anual con descuento.'
  },
  {
    q: '¿Puedo probar antes de pagar?',
    a: 'Sí. El plan Free te da un torneo completo, con llave, pantalla en vivo y página pública. No pedimos tarjeta.'
  },
  {
    q: '¿Y si esa noche no puedo ir al bar?',
    a: 'Designás organizadores en tu liga y cualquiera de ellos opera el torneo desde su cuenta. No hace falta que le pases tu contraseña a nadie.'
  },
  {
    q: '¿Sirve para una liga larga?',
    a: 'Para eso está pensada. Creás la liga, le colgás los torneos de la temporada y la tabla acumulada se arma sola torneo a torneo.'
  }
];

export default FAQ;
