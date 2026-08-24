import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, TextField, Typography } from '@mui/material';
import {
  MIN_TOURNAMENT_TEAMS,
  MAX_TOURNAMENT_TEAMS,
  TOURNAMENT_TEAMS_PRESETS,
  isValidNumberOfTeams,
  matchCountFor,
  roundsFor
} from '../utils/tournament';

interface Props {
  value: number;
  onChange: (numberOfTeams: number) => void;
  /** Jugadores por equipo (2 en duos, 3 en tríos), para mostrar el cupo total. */
  teamSize: number;
  disabled?: boolean;
  /** Ej. "No se puede cambiar con equipos o inscriptos ya cargados". */
  disabledHint?: string;
}

/**
 * Selector de tamaño del cuadro: presets de un toque (8/16/32, los tamaños
 * más comunes) + un campo libre para cualquier valor entre
 * MIN_TOURNAMENT_TEAMS y MAX_TOURNAMENT_TEAMS — el caso real que motivó esto
 * (42 jugadores en tríos = 14 equipos) no es ninguno de los presets. Muestra
 * de un vistazo cuántas rondas y partidos implica antes de confirmar: un
 * cuadro de 32 son 80 partidos, una jornada larga que conviene ver venir.
 */
const TeamCountSelector: React.FC<Props> = ({ value, onChange, teamSize, disabled, disabledHint }) => {
  const [customText, setCustomText] = React.useState(String(value));
  React.useEffect(() => setCustomText(String(value)), [value]);

  const isPreset = (TOURNAMENT_TEAMS_PRESETS as readonly number[]).includes(value);
  const rounds = roundsFor(value);
  const matches = matchCountFor(value);
  const players = value * teamSize;

  // Confirma apenas el texto tipeado sea un número válido, sin esperar a que
  // el campo pierda el foco: si el usuario nunca hace blur (toca "listo" en
  // el teclado numérico del celular, o pasa directo al siguiente campo con
  // un gesto que no dispara blur en ciertos navegadores), el cambio quedaba
  // sin aplicarse y el cuadro se guardaba con el valor anterior.
  const commitIfValid = (text: string) => {
    const parsed = parseInt(text, 10);
    if (Number.isFinite(parsed) && isValidNumberOfTeams(parsed)) {
      onChange(parsed);
    }
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    commitIfValid(text);
  };

  const commitCustom = () => {
    const parsed = parseInt(customText, 10);
    if (!Number.isFinite(parsed) || !isValidNumberOfTeams(parsed)) {
      setCustomText(String(value)); // valor inválido: vuelve al último válido
    }
  };

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Cantidad de equipos
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <ToggleButtonGroup
          color="gold"
          exclusive
          value={isPreset ? value : null}
          onChange={(_, next) => next !== null && onChange(next)}
          disabled={disabled}
        >
          {TOURNAMENT_TEAMS_PRESETS.map((preset) => (
            <ToggleButton key={preset} value={preset}>
              {preset}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          label="Otro"
          type="number"
          size="small"
          value={customText}
          onChange={(e) => handleCustomChange(e.target.value)}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            // Enter no debería enviar el formulario que envuelve a este
            // selector: solo confirma el número y saca el foco.
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={disabled}
          inputProps={{ min: MIN_TOURNAMENT_TEAMS, max: MAX_TOURNAMENT_TEAMS }}
          sx={{ width: 100 }}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
        {disabled && disabledHint ? (
          disabledHint
        ) : (
          <>
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {players} jugadores individuales
            </Box>{' '}
            · {value} equipos · {rounds} rondas · {matches} partidos
          </>
        )}
      </Typography>
    </Box>
  );
};

export default TeamCountSelector;
