import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0D1B2A", 
      light: "#63a4ff",
      dark: "#004ba0",
    },
    secondary: {
      main: "#B22222", 
      light: "#FFD700",
      dark: "#c66900",
    },
    background: {
      default: "#122620",
      paper: "#1E2D3D",   
    },
    text: {
      primary: "#F8F9FA",
      secondary: "#CED4DA",
    },
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

export default theme;
