/**
 * Utility functions for worker color coding based on union membership status and roles
 */

import type { CSSProperties } from "react";

export interface WorkerColorInfo {
  /** Faded background for wall chart blocks/cards (class for fallback plus inline style for reliability) */
  bgFadedClass: string;
  bgStyle: CSSProperties;
  /** Full-colour background for badges and icon indicators */
  badgeClass: string;
  badgeStyle: CSSProperties;
  /** Full-colour background for small dots/indicators */
  indicatorClass: string;
  indicatorStyle: CSSProperties;
  /** Optional border colour */
  borderStyle: CSSProperties;
  /** Text colour to pair with the full-colour background */
  textColor: string;
  /** Human-readable label for the colour meaning */
  label: string;
}

/**
 * Get color coding for a worker based on their union membership status and roles
 */
export function getWorkerColorCoding(
  membershipStatus: string | null,
  roles: string[] = []
): WorkerColorInfo {
  // Colour definitions from brief (converted to RGB)
  // Delegate & HSR blue: CMYK 100-70-0-10 → rgb(0,69,230)
  const leaderBlueRgb = '0,69,230';
  // Union member red (Pantone 2347 C): CMYK 0-88-92-13 → rgb(222,27,18)
  const memberRedRgb = '222,27,18';
  // Declined yellow: CMYK 0-0-13-0 → rgb(255,255,222)
  const declinedYellowRgb = '255,255,222';
  // Non-union spring green: CMYK 60-0-80-0 → rgb(102,255,51)
  const springGreenRgb = '102,255,51';

  const asFadedBg = (rgb: string, alpha: number) => `bg-[rgba(${rgb},${alpha})]`;
  const asFadedStyle = (rgb: string, alpha: number): CSSProperties => ({ backgroundColor: `rgba(${rgb},${alpha})` });
  const asSolidBg = (rgb: string) => `bg-[rgb(${rgb})]`;
  const asSolidStyle = (rgb: string): CSSProperties => ({ backgroundColor: `rgb(${rgb})` });
  const withBorder = (rgb: string, alpha: number) => `border-[rgba(${rgb},${alpha})]`;
  const borderStyle = (rgb: string, alpha: number): CSSProperties => ({ borderColor: `rgba(${rgb},${alpha})` });

  // Leadership (delegate or HSR)
  const hasLeadershipRole = roles.some(role => role === 'company_delegate' || role === 'hsr');
  if (hasLeadershipRole) {
    return {
      bgFadedClass: asFadedBg(leaderBlueRgb, 0.15),
      bgStyle: asFadedStyle(leaderBlueRgb, 0.15),
      badgeClass: `${asSolidBg(leaderBlueRgb)} ${withBorder(leaderBlueRgb, 0.3)}`,
      badgeStyle: asSolidStyle(leaderBlueRgb),
      indicatorClass: asSolidBg(leaderBlueRgb),
      indicatorStyle: asSolidStyle(leaderBlueRgb),
      borderStyle: borderStyle(leaderBlueRgb, 0.3),
      textColor: 'text-white',
      label: 'Delegates & HSRs'
    };
  }

  // Membership status colours
  switch (membershipStatus) {
    case 'member':
      return {
        bgFadedClass: asFadedBg(memberRedRgb, 0.15),
        bgStyle: asFadedStyle(memberRedRgb, 0.15),
        badgeClass: `${asSolidBg(memberRedRgb)} ${withBorder(memberRedRgb, 0.3)}`,
        badgeStyle: asSolidStyle(memberRedRgb),
        indicatorClass: asSolidBg(memberRedRgb),
        indicatorStyle: asSolidStyle(memberRedRgb),
        borderStyle: borderStyle(memberRedRgb, 0.3),
        textColor: 'text-white',
        label: 'Union Member'
      };
    case 'potential':
    case 'potential_member':
      return {
        // 50% more transparent than the member red
        bgFadedClass: asFadedBg(memberRedRgb, 0.075),
        bgStyle: asFadedStyle(memberRedRgb, 0.075),
        // Keep the same hue but half opacity for badges/icons to visually differentiate
        badgeClass: `bg-[rgba(${memberRedRgb},0.5)] ${withBorder(memberRedRgb, 0.25)}`,
        badgeStyle: { backgroundColor: `rgba(${memberRedRgb},0.5)` },
        indicatorClass: `bg-[rgba(${memberRedRgb},0.5)]`,
        indicatorStyle: { backgroundColor: `rgba(${memberRedRgb},0.5)` },
        borderStyle: borderStyle(memberRedRgb, 0.25),
        textColor: 'text-white',
        label: 'Potential Member'
      };
    case 'declined':
      return {
        bgFadedClass: asFadedBg(declinedYellowRgb, 0.35),
        bgStyle: asFadedStyle(declinedYellowRgb, 0.35),
        badgeClass: `${asSolidBg(declinedYellowRgb)} ${withBorder(declinedYellowRgb, 0.4)}`,
        badgeStyle: asSolidStyle(declinedYellowRgb),
        indicatorClass: asSolidBg(declinedYellowRgb),
        indicatorStyle: asSolidStyle(declinedYellowRgb),
        borderStyle: borderStyle(declinedYellowRgb, 0.4),
        // Yellow works best with dark text for contrast
        textColor: 'text-black',
        label: 'Declined Membership'
      };
    case 'non_member':
    default:
      return {
        bgFadedClass: asFadedBg(springGreenRgb, 0.15),
        bgStyle: asFadedStyle(springGreenRgb, 0.15),
        badgeClass: `${asSolidBg(springGreenRgb)} ${withBorder(springGreenRgb, 0.3)}`,
        badgeStyle: asSolidStyle(springGreenRgb),
        indicatorClass: asSolidBg(springGreenRgb),
        indicatorStyle: asSolidStyle(springGreenRgb),
        borderStyle: borderStyle(springGreenRgb, 0.3),
        textColor: 'text-black',
        label: 'Non-Member'
      };
  }
}

/**
 * Get the color legend for the worker color coding system
 */
export function getWorkerColorLegend(): Array<{
  color: string;
  textColor: string;
  label: string;
  description: string;
  style: CSSProperties;
}> {
  // Use the same faded background classes as the wall chart blocks
  const leader = getWorkerColorCoding('member', ['company_delegate']);
  const member = getWorkerColorCoding('member');
  const potential = getWorkerColorCoding('potential');
  const declined = getWorkerColorCoding('declined');
  const nonMember = getWorkerColorCoding('non_member');

  return [
    {
      color: leader.bgFadedClass,
      textColor: leader.textColor,
      label: 'Leadership',
      description: 'Delegates & HSRs',
      style: leader.bgStyle
    },
    {
      color: member.bgFadedClass,
      textColor: member.textColor,
      label: 'Member',
      description: 'Union members',
      style: member.bgStyle
    },
    {
      color: potential.bgFadedClass,
      textColor: potential.textColor,
      label: 'Potential',
      description: 'Potential members',
      style: potential.bgStyle
    },
    {
      color: declined.bgFadedClass,
      textColor: declined.textColor,
      label: 'Declined',
      description: 'Declined membership',
      style: declined.bgStyle
    },
    {
      color: nonMember.bgFadedClass,
      textColor: nonMember.textColor,
      label: 'Non-Member',
      description: 'Non-union workers',
      style: nonMember.bgStyle
    }
  ];
}