import AccountTreeIcon from '@mui/icons-material/AccountTree';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import ShareIcon from '@mui/icons-material/Share';
import ImageIcon from '@mui/icons-material/Image';
import type { SvgIconComponent } from '@mui/icons-material';

export interface LandingFeature {
  icon: SvgIconComponent;
  title: string;
  body: string;
}

export const FEATURES: LandingFeature[] = [
  {
    icon: AccountTreeIcon,
    title: 'Llave con doble rama',
    body: 'El que pierde no se va a su casa: pasa a la rama plata y sigue jugando. Armás la llave con la cantidad de equipos que tengas esa noche, y todos juegan al menos dos partidos.'
  },
  {
    icon: EmojiEventsIcon,
    title: 'Distintos sistemas de puntuación',
    body: 'Elegís cómo se reparten los puntos en cada torneo, según cuánto pese la noche. Los puntos se suman solos al ranking de cada jugador.'
  },
  {
    icon: GroupsIcon,
    title: 'Parejas o tríos',
    body: 'Elegís el formato al crear el torneo y la llave se arma sola con la cantidad de jugadores que corresponde.'
  },
  {
    icon: ShuffleIcon,
    title: 'Tres formas de armar los equipos',
    body: 'Se anotan las parejas ya armadas, sorteás al azar delante de todos, o los acomodás vos a mano con el editor de plantel.'
  },
  {
    icon: PersonAddIcon,
    title: 'Invitados sin cuenta',
    body: 'El que cayó de sorpresa y no se quiere registrar juega igual: lo cargás con el nombre y listo, mezclado con los que sí tienen cuenta.'
  },
  {
    icon: LeaderboardIcon,
    title: 'Ligas y temporadas',
    body: 'Colgale los torneos del mes o del año a una liga y la tabla acumulada se arma sola, con puntos que se suman fecha a fecha como en el ranking ATP.'
  },
  {
    icon: SupervisorAccountIcon,
    title: 'Organizadores designados',
    body: 'Si esta noche no estás en el bar, otro de tu equipo opera el torneo desde su propia cuenta. Sin pasarle tu contraseña a nadie.'
  },
  {
    icon: ShareIcon,
    title: 'Página pública para compartir',
    body: 'Cada torneo y cada liga tienen su link sin login. Lo tirás al grupo de WhatsApp y todos ven la llave y la tabla desde el celular.'
  },
  {
    icon: ImageIcon,
    title: 'El logo de tu club en pantalla',
    body: 'Subís el escudo de tu bar o de tu liga y aparece en la pantalla en vivo y en la página pública del torneo.'
  }
];

export default FEATURES;
