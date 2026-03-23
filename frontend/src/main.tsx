import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import App from "./App";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1a237e",
      light: "#534bae",
      dark: "#000051",
    },
    secondary: {
      main: "#00897b",
      light: "#4ebaaa",
      dark: "#005b4f",
    },
    success: { main: "#2e7d32" },
    warning: { main: "#ed6c02" },
    error: { main: "#d32f2f" },
    background: {
      default: "#f5f5f7",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 10,
          padding: "10px 24px",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 10,
          },
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
