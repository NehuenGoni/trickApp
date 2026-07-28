/**
 * Metadata del logo de un torneo. El binario se pide aparte a
 * `API_ROUTES.TOURNAMENTS.LOGO(id, version)`; acá viaja solo lo necesario para
 * saber si hay imagen y armar la URL con cache buster.
 *
 * El tipo `Tournament` está duplicado en varias vistas con campos distintos
 * (TournamentList, TournamentDetails, AdminTournaments, useLiveTournament).
 * Este módulo existe para que al menos el logo se declare en un solo lugar.
 */
export interface TournamentLogoMeta {
  version: string;
  mimeType: string;
  size: number;
}

/** Forma mínima que necesita `<TournamentLogo />` para renderizar. */
export interface TournamentLogoSource {
  _id: string;
  name: string;
  logo?: TournamentLogoMeta | null;
}
