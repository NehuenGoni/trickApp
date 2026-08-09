import { createTheme, alpha, PaletteColorOptions } from "@mui/material/styles";

// Module augmentation: registra el canal de color "gold" en el sistema de
// tipos de MUI para poder usar color="gold" en Button, Chip, TextField, etc.
declare module "@mui/material/styles" {
  interface Palette {
    gold: Palette["primary"];
  }
  interface PaletteOptions {
    gold?: PaletteColorOptions;
  }
}

declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    gold: true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    gold: true;
  }
}

declare module "@mui/material/CircularProgress" {
  interface CircularProgressPropsColorOverrides {
    gold: true;
  }
}

declare module "@mui/material/LinearProgress" {
  interface LinearProgressPropsColorOverrides {
    gold: true;
  }
}

declare module "@mui/material/ToggleButtonGroup" {
  interface ToggleButtonGroupPropsColorOverrides {
    gold: true;
  }
}

declare module "@mui/material/ToggleButton" {
  interface ToggleButtonPropsColorOverrides {
    gold: true;
  }
}

// Paleta base. El "mode: dark" es la pieza que faltaba: sin esto MUI sigue
// calculando divider/disabled/hover/bordes/sombras para fondo blanco, aunque
// background y text ya estén pensados para fondo oscuro.
const baseTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#0D1B2A",
      light: "#63a4ff",
      dark: "#004ba0",
    },
    secondary: {
      main: "#B22222",
      light: "#FFD700",
      dark: "#8B1A1A",
    },
    background: {
      default: "#122620",
      paper: "#1E2D3D",
    },
    text: {
      primary: "#F8F9FA",
      secondary: "#CED4DA",
    },
    divider: "rgba(255,255,255,0.08)",
  },
  typography: {
    fontFamily: "'Montserrat', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    h1: {
      fontFamily: "'Merriweather', 'Montserrat', serif",
      fontSize: "2.5rem",
      fontWeight: 700,
    },
    h2: {
      fontFamily: "'Merriweather', 'Montserrat', serif",
      fontSize: "2rem",
      fontWeight: 600,
    },
    body1: {
      fontFamily: "'Montserrat', sans-serif",
      fontSize: "1rem",
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
});

// Canal de color "gold" (#FFD700), el acento que ya usaban a mano Login y
// CreateMatch. augmentColor deriva light/dark/contrastText automáticamente.
const GOLD = "#FFD700";
const GOLD_DARK = "#FFC400";

const theme = createTheme(baseTheme, {
  palette: {
    gold: baseTheme.palette.augmentColor({
      color: {
        main: GOLD,
        dark: GOLD_DARK,
        contrastText: "#000000",
      },
      name: "gold",
    }),
  },
  components: {
    MuiButton: {
      defaultProps: {
        color: "secondary",
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255,255,255,0.23)",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: alpha(GOLD, 0.4),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: GOLD,
          },
          "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255,255,255,0.12)",
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          "&.Mui-focused": {
            color: GOLD,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: GOLD,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: "#CED4DA",
          "&.Mui-selected": {
            color: GOLD,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 8,
          borderRadius: 4,
        },
        colorPrimary: {
          backgroundColor: alpha(GOLD, 0.15),
        },
        // Ojo: la clase genérica "bar" se aplica a TODOS los colores (también
        // warning/error), por eso se acota a "barColorPrimary" para no pisar
        // las barras de progreso en estado de límite alcanzado.
        barColorPrimary: {
          backgroundColor: GOLD,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#0D1B2A",
          borderBottom: `1px solid ${alpha(GOLD, 0.2)}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "rgba(255,255,255,0.08)",
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          "&.Mui-checked": {
            color: GOLD,
          },
          "&.Mui-checked + .MuiSwitch-track": {
            backgroundColor: GOLD,
            opacity: 0.5,
          },
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: "1px solid rgba(255,255,255,0.08)",
        },
      },
    },
  },
});

export default theme;
