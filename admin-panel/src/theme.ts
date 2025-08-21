import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1a237e',
            light: '#534bae',
            dark: '#000051',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#f50057',
            light: '#ff5983',
            dark: '#bb002f',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f5f5f5',
            paper: '#ffffff',
        },
    },
    typography: {
        fontFamily: [
            'Roboto',
            'Arial',
            'sans-serif',
        ].join(','),
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                },
            },
        },
    },
});

export default theme; 