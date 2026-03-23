import { useState, useRef } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Paper,
  LinearProgress,
  Stack,
  Fade,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ScienceIcon from '@mui/icons-material/Science';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';
import GavelIcon from '@mui/icons-material/Gavel';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import type { NLCheckResult } from './services/api';
import { checkIngredientNL } from './services/api';

// ─── Status display config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { color: 'success' | 'error' | 'warning' | 'info'; icon: ReactElement; label: string; description: string }
> = {
  ALLOWED: {
    color: 'success',
    icon: <CheckCircleIcon />,
    label: 'Allowed',
    description: 'Not listed in Annexes II–VI. Generally permitted under Article 3.',
  },
  NOT_FOUND: {
    color: 'success',
    icon: <CheckCircleIcon />,
    label: 'Not Listed — Allowed',
    description: 'Not found in the restricted annexes. Generally permitted, but absence does not guarantee safety.',
  },
  RESTRICTED: {
    color: 'warning',
    icon: <WarningIcon />,
    label: 'Restricted',
    description: 'Permitted only under specific conditions. See conditions below.',
  },
  EXCEEDS_LIMIT: {
    color: 'error',
    icon: <ErrorOutlineIcon />,
    label: 'Exceeds Limit',
    description: 'The queried concentration is above the regulatory maximum.',
  },
  PROHIBITED: {
    color: 'error',
    icon: <CancelIcon />,
    label: 'Prohibited',
    description: 'Listed in Annex II — unconditionally banned in cosmetic products.',
  },
};


const EXAMPLES = [
  'is phenoxyethanol at 1% safe in a leave-on cream?',
  'octocrylene 12% in sunscreen',
  'hydroquinone in hair dye',
  'can I use glycerin at 5%?',
];

// ─── Component ────────────────────────────────────────────────────────────────

function App() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NLCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await checkIngredientNL(text.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setText('');
    setResult(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !loading) {
      handleCheck();
    }
  };

  const statusConfig = result ? STATUS_CONFIG[result.verdict.status] ?? STATUS_CONFIG.RESTRICTED : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 6 }}>

      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #00897b 100%)',
          color: 'white',
          py: 5,
          px: 3,
          mb: 4,
          borderRadius: 0,
        }}
      >
        <Container maxWidth="md">
          <Stack direction="row" alignItems="center" spacing={2} mb={1}>
            <ScienceIcon sx={{ fontSize: 40 }} />
            <Typography variant="h4" fontWeight={700}>EU Cosmetics Compliance Agent</Typography>
          </Stack>
          <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.9, mb: 1 }}>
            EU Cosmetics Regulation Compliance Checker
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Regulation (EC) No 1223/2009 — Annexes II–VI — deterministic rule engine
          </Typography>
        </Container>
      </Paper>

      <Container maxWidth="md">

        {/* Natural language input */}
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchIcon color="primary" />
              Ask a compliance question
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Describe the ingredient, concentration, and product type in plain language.
            </Typography>

            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={6}
              placeholder={`e.g. "${EXAMPLES[0]}"`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoFocus
              inputRef={inputRef}
              helperText="Press Cmd+Enter to submit"
              sx={{ mb: 2 }}
            />

            {/* Example pills */}
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
              {EXAMPLES.map((ex) => (
                <Chip
                  key={ex}
                  label={ex}
                  size="small"
                  variant="outlined"
                  onClick={() => { setText(ex); inputRef.current?.focus(); }}
                  disabled={loading}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>

            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                size="large"
                onClick={handleCheck}
                disabled={!text.trim() || loading}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <GavelIcon />}
                sx={{ minWidth: 200 }}
              >
                {loading ? 'Analyzing...' : 'Check Compliance'}
              </Button>
              {(result || error) && (
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleReset}
                  startIcon={<RestartAltIcon />}
                >
                  Reset
                </Button>
              )}
            </Stack>
          </CardContent>
          {loading && <LinearProgress />}
        </Card>

        {/* Loading state */}
        {loading && (
          <Fade in>
            <Card sx={{ mb: 3 }}>
              <CardContent sx={{ textAlign: 'center', py: 5 }}>
                <CircularProgress size={48} sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Parsing your question and checking Annexes II–VI…
                </Typography>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* Error */}
        {error && (
          <Fade in>
            <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          </Fade>
        )}

        {/* Results */}
        {result && statusConfig && (
          <Fade in>
            <Box>

              {/* Parsed query — shows what the LLM extracted */}
              <Card sx={{ mb: 2, bgcolor: 'grey.50' }}>
                <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} letterSpacing={0.5}>
                    PARSED AS
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1} mt={0.5}>
                    <Chip label={result.query.name} size="small" color="primary" variant="filled" />
                    {result.query.concentration !== undefined && (
                      <Chip label={`${result.query.concentration}%`} size="small" variant="outlined" />
                    )}
                    {result.query.productType && (
                      <Chip label={result.query.productType} size="small" variant="outlined" />
                    )}
                    {result.query.cas && (
                      <Chip label={`CAS ${result.query.cas}`} size="small" variant="outlined" />
                    )}
                  </Stack>
                </CardContent>
              </Card>

              {/* Status banner */}
              <Alert
                severity={statusConfig.color}
                icon={statusConfig.icon}
                sx={{ mb: 3, borderRadius: 3 }}
              >
                <AlertTitle sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  {result.verdict.ingredient} — {statusConfig.label}
                </AlertTitle>
                <Typography variant="body2">{statusConfig.description}</Typography>
              </Alert>


              <Stack spacing={2}>

                {/* Quick facts */}
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Quick Facts
                    </Typography>
                    <Stack spacing={1.5} divider={<Divider />}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Box mt={0.5}>
                          <Chip
                            label={statusConfig.label}
                            color={statusConfig.color}
                            icon={statusConfig.icon}
                            size="small"
                          />
                        </Box>
                      </Box>

                      {result.verdict.maxConcentrationRaw && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Max Concentration</Typography>
                          <Typography variant="body2" fontWeight={600} mt={0.5}>
                            {result.verdict.maxConcentrationRaw}
                          </Typography>
                        </Box>
                      )}

                      {result.verdict.concentration !== undefined && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Queried At</Typography>
                          <Typography variant="body2" mt={0.5}>{result.verdict.concentration}%</Typography>
                        </Box>
                      )}

                      {result.verdict.productType && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Product Type</Typography>
                          <Typography variant="body2" mt={0.5}>{result.verdict.productType}</Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Annex references */}
                {result.verdict.annexReferences.length > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Regulation References
                      </Typography>
                      <Stack spacing={1}>
                        {result.verdict.annexReferences.map((ref, i) => (
                          <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                            <Typography variant="caption" color="primary" fontWeight={600}>
                              {ref.annex}{ref.entry ? ` — Entry ${ref.entry}` : ''}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                              {ref.description}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* Source */}
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Source</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {result.verdict.source}
                    </Typography>
                  </CardContent>
                </Card>

              </Stack>
            </Box>
          </Fade>
        )}
      </Container>
    </Box>
  );
}

export default App;
