import React from 'react';
import { Box } from '@mui/material';
import LandingNav from '../../components/landing/LandingNav';
import LandingFooter from '../../components/landing/LandingFooter';
import HeroSection from './sections/HeroSection';
import FeaturesSection from './sections/FeaturesSection';
import HowItWorksSection from './sections/HowItWorksSection';
import LiveTvSection from './sections/LiveTvSection';
import CasualPlayerSection from './sections/CasualPlayerSection';
import PricingTeaserSection from './sections/PricingTeaserSection';
import FaqSection from './sections/FaqSection';
import FinalCtaSection from './sections/FinalCtaSection';

/** One-pager de marketing en `/`. Composición pura — cada sección trae
 *  su propio contenido y estilos, acá solo se define el orden. */
const Landing = () => (
  <Box sx={{ bgcolor: 'background.default', overflowX: 'hidden' }}>
    <LandingNav />
    <HeroSection />
    <FeaturesSection />
    <HowItWorksSection />
    <LiveTvSection />
    <CasualPlayerSection />
    <PricingTeaserSection />
    <FaqSection />
    <FinalCtaSection />
    <LandingFooter />
  </Box>
);

export default Landing;
