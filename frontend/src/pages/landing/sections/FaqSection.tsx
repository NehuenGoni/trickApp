import React from 'react';
import { Accordion, AccordionSummary, AccordionDetails, Typography, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Section from '../../../components/landing/Section';
import SectionHeading from '../../../components/landing/SectionHeading';
import Reveal from '../../../components/landing/Reveal';
import { GOLD } from '../../../components/landing/landingTokens';
import { FAQ } from '../content/faq';

const FaqSection = () => (
  <Section id="faq" tone="felt" maxWidth="md">
    <SectionHeading eyebrow="PREGUNTAS FRECUENTES" title="Lo que suelen preguntar antes de empezar" />

    <Box sx={{ mt: { xs: 3, md: 4 } }}>
      {FAQ.map((item, i) => (
        <Reveal delay={Math.min(i * 40, 240)} key={item.q}>
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              bgcolor: 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 }
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: GOLD }} />}
              sx={{ px: 0, py: 1 }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {item.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pb: 2.5 }}>
              <Typography variant="body2" color="text.secondary">
                {item.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Reveal>
      ))}
    </Box>
  </Section>
);

export default FaqSection;
