import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
export default (phase) => ({ distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next', devIndicators: false, async headers(){return [{source:"/(.*)",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"X-Frame-Options",value:"DENY"}]}]} });
