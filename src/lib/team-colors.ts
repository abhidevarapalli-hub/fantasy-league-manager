import { cn } from './utils';

/**
 * Team Color Configuration
 * 
 * Maps team names/codes to their primary colors for UI elements.
 * Includes both IPL and International teams.
 */

export interface TeamColor {
    bg: string;
    text: string;
    border: string;
    raw?: string; // Hex or RGB for custom usage
}

export const TEAM_COLORS: Record<string, TeamColor> = {
    // IPL Teams
    'CSK': { bg: 'bg-[#FFCB05]', text: 'text-black', border: 'border-[#FFCB05]', raw: '#FFCB05' },
    'MI': { bg: 'bg-[#004B91]', text: 'text-white', border: 'border-[#004B91]', raw: '#004B91' },
    'RCB': { bg: 'bg-[#800000]', text: 'text-white', border: 'border-[#800000]', raw: '#800000' },
    'KKR': { bg: 'bg-[#3A225D]', text: 'text-white', border: 'border-[#3A225D]', raw: '#3A225D' },
    'DC': { bg: 'bg-[#000080]', text: 'text-white', border: 'border-[#000080]', raw: '#000080' },
    'RR': { bg: 'bg-[#EB71A6]', text: 'text-white', border: 'border-[#EB71A6]', raw: '#EB71A6' },
    'PBKS': { bg: 'bg-[#B71E24]', text: 'text-white', border: 'border-[#B71E24]', raw: '#B71E24' },
    'SRH': { bg: 'bg-[#FF822A]', text: 'text-white', border: 'border-[#FF822A]', raw: '#FF822A' },
    'GT': { bg: 'bg-[#1B223D]', text: 'text-white', border: 'border-[#1B223D]', raw: '#1B223D' },
    'LSG': { bg: 'bg-[#2ABFCB]', text: 'text-white', border: 'border-[#2ABFCB]', raw: '#2ABFCB' },

    // International Teams (Full names and 3-letter codes)
    'India': { bg: 'bg-[#0038A8]', text: 'text-white', border: 'border-[#0038A8]', raw: '#0038A8' },
    'IND': { bg: 'bg-[#0038A8]', text: 'text-white', border: 'border-[#0038A8]', raw: '#0038A8' },
    'Sri Lanka': { bg: 'bg-[#191970]', text: 'text-white', border: 'border-[#191970]', raw: '#191970' },
    'SL': { bg: 'bg-[#191970]', text: 'text-white', border: 'border-[#191970]', raw: '#191970' },
    'Pakistan': { bg: 'bg-[#004020]', text: 'text-white', border: 'border-[#004020]', raw: '#004020' },
    'PAK': { bg: 'bg-[#004020]', text: 'text-white', border: 'border-[#004020]', raw: '#004020' },
    'South Africa': { bg: 'bg-[#007A33]', text: 'text-white', border: 'border-[#007A33]', raw: '#007A33' },
    'SA': { bg: 'bg-[#007A33]', text: 'text-white', border: 'border-[#007A33]', raw: '#007A33' },
    'Australia': { bg: 'bg-[#FFCC00]', text: 'text-black', border: 'border-[#FFCC00]', raw: '#FFCC00' },
    'AUS': { bg: 'bg-[#FFCC00]', text: 'text-black', border: 'border-[#FFCC00]', raw: '#FFCC00' },
    'England': { bg: 'bg-[#C41E3A]', text: 'text-white', border: 'border-[#C41E3A]', raw: '#C41E3A' },
    'ENG': { bg: 'bg-[#C41E3A]', text: 'text-white', border: 'border-[#C41E3A]', raw: '#C41E3A' },
    'New Zealand': { bg: 'bg-[#000000]', text: 'text-white', border: 'border-[#000000]', raw: '#000000' },
    'NZ': { bg: 'bg-[#000000]', text: 'text-white', border: 'border-[#000000]', raw: '#000000' },
    'West Indies': { bg: 'bg-[#800000]', text: 'text-white', border: 'border-[#800000]', raw: '#800000' },
    'WI': { bg: 'bg-[#800000]', text: 'text-white', border: 'border-[#800000]', raw: '#800000' },
    'Afghanistan': { bg: 'bg-[#0047AB]', text: 'text-white', border: 'border-[#0047AB]', raw: '#0047AB' },
    'AFG': { bg: 'bg-[#0047AB]', text: 'text-white', border: 'border-[#0047AB]', raw: '#0047AB' },
    'Ireland': { bg: 'bg-[#009A44]', text: 'text-white', border: 'border-[#009A44]', raw: '#009A44' },
    'IRE': { bg: 'bg-[#009A44]', text: 'text-white', border: 'border-[#009A44]', raw: '#009A44' },
    'Netherlands': { bg: 'bg-[#FF8500]', text: 'text-white', border: 'border-[#FF8500]', raw: '#FF8500' },
    'NED': { bg: 'bg-[#FF8500]', text: 'text-white', border: 'border-[#FF8500]', raw: '#FF8500' },
    'USA': { bg: 'bg-[#002366]', text: 'text-white', border: 'border-[#002366]', raw: '#002366' },
    'Scotland': { bg: 'bg-[#663399]', text: 'text-white', border: 'border-[#663399]', raw: '#663399' },
    'SCO': { bg: 'bg-[#663399]', text: 'text-white', border: 'border-[#663399]', raw: '#663399' },
    'Canada': { bg: 'bg-[#FF0000]', text: 'text-white', border: 'border-[#FF0000]', raw: '#FF0000' },
    'CAN': { bg: 'bg-[#FF0000]', text: 'text-white', border: 'border-[#FF0000]', raw: '#FF0000' },
    'Nepal': { bg: 'bg-[#DC143C]', text: 'text-white', border: 'border-[#DC143C]', raw: '#DC143C' },
    'NEP': { bg: 'bg-[#DC143C]', text: 'text-white', border: 'border-[#DC143C]', raw: '#DC143C' },
    'Oman': { bg: 'bg-[#ED1C24]', text: 'text-white', border: 'border-[#ED1C24]', raw: '#ED1C24' },
    'OMN': { bg: 'bg-[#ED1C24]', text: 'text-white', border: 'border-[#ED1C24]', raw: '#ED1C24' },
    'Namibia': { bg: 'bg-[#00BFFF]', text: 'text-white', border: 'border-[#00BFFF]', raw: '#00BFFF' },
    'NAM': { bg: 'bg-[#00BFFF]', text: 'text-white', border: 'border-[#00BFFF]', raw: '#00BFFF' },
    'Italy': { bg: 'bg-[#007FFF]', text: 'text-white', border: 'border-[#007FFF]', raw: '#007FFF' },
    'ITA': { bg: 'bg-[#007FFF]', text: 'text-white', border: 'border-[#007FFF]', raw: '#007FFF' },
    'UAE': { bg: 'bg-[#C0C0C0]', text: 'text-black', border: 'border-[#C0C0C0]', raw: '#C0C0C0' },
    'Papua New Guinea': { bg: 'bg-[#FFD700]', text: 'text-black', border: 'border-[#FFD700]', raw: '#FFD700' },
    'PNG': { bg: 'bg-[#FFD700]', text: 'text-black', border: 'border-[#FFD700]', raw: '#FFD700' },
    'Zimbabwe': { bg: 'bg-[#E41E26]', text: 'text-white', border: 'border-[#E41E26]', raw: '#E41E26' },
    'ZIM': { bg: 'bg-[#E41E26]', text: 'text-white', border: 'border-[#E41E26]', raw: '#E41E26' },
};

/**
 * Get team colors with a fallback
 */
export function getTeamColors(teamName: string): TeamColor {
    return TEAM_COLORS[teamName] || {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        border: 'border-border',
        raw: '#808080'
    };
}

/**
 * Get the style props for a team-colored pill
 */
export function getTeamPillStyles(teamName: string, active: boolean) {
    if (teamName === 'All') {
        return {
            className: active
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30',
            style: {}
        };
    }

    const colors = getTeamColors(teamName);

    if (!active) {
        return {
            className: 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30',
            style: {}
        };
    }

    // Active state: Using inline styles for background to ensure it works with dynamic hex codes
    // Construct RGBA for background and border from the raw hex
    const raw = colors.raw || '#808080';

    // We'll return the text color as a class (standard Tailwind)
    // and the background/border as inline styles for total reliability
    return {
        className: cn(
            "border transition-all",
            colors.text
        ),
        style: {
            backgroundColor: `${raw}33`, // 20% opacity in hex (33)
            borderColor: `${raw}4D`,     // 30% opacity in hex (4D)
        }
    };
}

export function getTeamFilterColors(teamName: string, active: boolean): string {
    const { className } = getTeamPillStyles(teamName, active);
    return className;
}
