// Curated AU-English plain-language explainer pack (ADR 0096 / E1, v1.63.0).
// One entry per PSPF Release 2025 section (sectionCode), not per individual requirement —
// see pspf-grand-plan.md "v1.70 Essentials programme" E1 row for the scoping decision.
import type { PspfDomainFamily } from "../index.js";

export interface RequirementExplainerEntry {
  readonly sectionCode: string;
  readonly domainFamily: PspfDomainFamily;
  readonly sectionTitle: string;
  /** "What this means" — plain-language restatement of what this section of PSPF asks for. */
  readonly whatThisMeans: string;
  /** "Why it matters" fallback, used when no linked risk gives a dynamic consequence statement. */
  readonly whyItMattersFallback: string;
  /** "What to do next" fallback, used when there is no open action or blocker to point to. */
  readonly whatToDoNextFallback: string;
  readonly sourceId: string;
  readonly licence: string;
  readonly attribution: string;
  readonly publication: "public";
}

const PSPF_SOURCE_ID = "pspf-release-2025-list-requirements";
const PSPF_LICENCE = "Creative Commons Attribution 3.0 Australia";
const PSPF_ATTRIBUTION =
  "Australian Government Department of Home Affairs (PSPF Release 2025) — plain-language restatement by the PSPF product team";

function entry(
  input: Omit<RequirementExplainerEntry, "sourceId" | "licence" | "attribution" | "publication">
): RequirementExplainerEntry {
  return {
    ...input,
    sourceId: PSPF_SOURCE_ID,
    licence: PSPF_LICENCE,
    attribution: PSPF_ATTRIBUTION,
    publication: "public"
  };
}

export const REQUIREMENT_EXPLAINERS: readonly RequirementExplainerEntry[] = [
  entry({
    sectionCode: "GOV 01",
    domainFamily: "GOV",
    sectionTitle: "WoAG Protective Security Roles",
    whatThisMeans:
      "This section is about the whole-of-government roles that set security direction and advice for every entity, not about your entity's own arrangements.",
    whyItMattersFallback:
      "Without these roles working properly, entities lack clear, consistent security direction to follow.",
    whatToDoNextFallback:
      "Confirm which whole-of-government role applies to this item and record the current state with a brief note."
  }),
  entry({
    sectionCode: "GOV 02",
    domainFamily: "GOV",
    sectionTitle: "Entity Protective Security Roles and Responsibilities",
    whatThisMeans:
      "Your entity needs named people responsible for security decisions — an Accountable Authority and the people who support them — with clear, written responsibilities.",
    whyItMattersFallback:
      "If nobody is clearly responsible for a security decision, problems can go unnoticed or unresolved for longer than they should.",
    whatToDoNextFallback:
      "Check that a named person is responsible for this item and that the responsibility is written down somewhere your entity can point to."
  }),
  entry({
    sectionCode: "GOV 03",
    domainFamily: "GOV",
    sectionTitle: "Security Planning, Incidents and Training",
    whatThisMeans:
      "Your entity needs a written security plan, a way to handle security incidents when they happen, and regular training so people know what to do.",
    whyItMattersFallback:
      "Without a plan, an incident process, and trained people, your entity is more likely to be caught out when something goes wrong.",
    whatToDoNextFallback:
      "Check whether a current plan, incident process, or training record exists for this item, and update it if it is out of date."
  }),
  entry({
    sectionCode: "GOV 04",
    domainFamily: "GOV",
    sectionTitle: "Protective Security Reporting",
    whatThisMeans:
      "Your entity needs to report its security position honestly and on time to the people who oversee government security.",
    whyItMattersFallback:
      "Late or inaccurate reporting means problems are hidden from the people who could help fix them.",
    whatToDoNextFallback:
      "Confirm the next reporting date for this item and make sure the information you would report is current."
  }),
  entry({
    sectionCode: "RISK 05",
    domainFamily: "RISK",
    sectionTitle: "Security Risk Management",
    whatThisMeans:
      "Your entity needs to actively identify and manage the security risks it faces, not just record them once and move on.",
    whyItMattersFallback: "A risk that is not actively managed can grow worse without anyone noticing.",
    whatToDoNextFallback:
      "Check when this risk was last reviewed and update the review if it has been more than a year."
  }),
  entry({
    sectionCode: "RISK 06",
    domainFamily: "RISK",
    sectionTitle: "Third Party Risk Management",
    whatThisMeans:
      "Your entity needs to manage the security risks that come from suppliers, contractors, and other outside parties it relies on.",
    whyItMattersFallback:
      "A supplier's security problem can become your entity's security problem if it is not checked and managed.",
    whatToDoNextFallback:
      "Check whether the relevant supplier or contract has a current security review, and arrange one if not."
  }),
  entry({
    sectionCode: "RISK 07",
    domainFamily: "RISK",
    sectionTitle: "Countering Foreign Interference and Espionage",
    whatThisMeans:
      "Your entity needs to be alert to attempts by foreign states or their agents to improperly influence or gather information from it.",
    whyItMattersFallback:
      "Unaddressed foreign interference risk can expose sensitive information or decisions to outside influence.",
    whatToDoNextFallback:
      "Check whether staff have current awareness training on this risk and raise any concerns through your entity's process."
  }),
  entry({
    sectionCode: "RISK 08",
    domainFamily: "RISK",
    sectionTitle: "Contingency Planning",
    whatThisMeans:
      "Your entity needs a tested plan for keeping essential functions running if a serious security disruption happens.",
    whyItMattersFallback:
      "Without a tested plan, a disruption is more likely to stop essential work for longer than necessary.",
    whatToDoNextFallback:
      "Check when this contingency plan was last tested and schedule a test if it has not been tested recently."
  }),
  entry({
    sectionCode: "INFO 09",
    domainFamily: "INFO",
    sectionTitle: "Classifications and Caveats",
    whatThisMeans:
      "Information needs to be labelled with the right sensitivity or classification level, and any special handling markers (caveats) need to be applied and respected.",
    whyItMattersFallback:
      "Wrongly labelled information can be seen by people who should not see it, or be handled less carefully than it needs to be.",
    whatToDoNextFallback:
      "Check that the information covered by this item has the correct classification and caveat markings applied."
  }),
  entry({
    sectionCode: "INFO 10",
    domainFamily: "INFO",
    sectionTitle: "Information Holdings",
    whatThisMeans:
      "Your entity needs to know what information it holds and keep control over where that information is and who can access it.",
    whyItMattersFallback: "Information your entity has lost track of cannot be protected properly.",
    whatToDoNextFallback:
      "Check that this information holding is recorded somewhere your entity can find and manage it."
  }),
  entry({
    sectionCode: "INFO 11",
    domainFamily: "INFO",
    sectionTitle: "Information Disposal",
    whatThisMeans:
      "When information is no longer needed, it needs to be disposed of securely so it cannot be recovered or misused.",
    whyItMattersFallback:
      "Information that is disposed of poorly can still be read or recovered by someone who should not have it.",
    whatToDoNextFallback: "Check that a secure disposal method was used and recorded for this information."
  }),
  entry({
    sectionCode: "INFO 12",
    domainFamily: "INFO",
    sectionTitle: "Information Sharing",
    whatThisMeans:
      "When your entity shares information with another entity or organisation, it needs to do so under a clear, agreed arrangement.",
    whyItMattersFallback:
      "Sharing information without a clear arrangement makes it hard to know how the other party will protect it.",
    whatToDoNextFallback:
      "Check whether a written sharing arrangement exists for this information and put one in place if not."
  }),
  entry({
    sectionCode: "TECH 13",
    domainFamily: "TECH",
    sectionTitle: "Technology Lifecycle Management",
    whatThisMeans:
      "Your entity needs to manage the security of its technology and systems from when they are introduced to when they are retired.",
    whyItMattersFallback: "A system that is not actively managed can develop security gaps as it ages.",
    whatToDoNextFallback:
      "Check when this system was last reviewed for security and schedule a review if it is overdue."
  }),
  entry({
    sectionCode: "TECH 14",
    domainFamily: "TECH",
    sectionTitle: "Cyber Security Strategies",
    whatThisMeans:
      "Your entity needs a documented approach for how it will address cyber security, aligned with government-wide cyber security guidance.",
    whyItMattersFallback:
      "Without a documented approach, cyber security work can be inconsistent or miss important areas.",
    whatToDoNextFallback:
      "Check that this item is reflected in your entity's current cyber security approach and update it if it is missing."
  }),
  entry({
    sectionCode: "TECH 15",
    domainFamily: "TECH",
    sectionTitle: "Cyber Security Programs",
    whatThisMeans:
      "Your entity needs to actually run the practical cyber security work — such as the Essential Eight — day to day, not just have a strategy on paper.",
    whyItMattersFallback: "A strategy that is not put into practice does not reduce cyber security risk.",
    whatToDoNextFallback: "Check the current status of this practical measure and record any gap as a next action."
  }),
  entry({
    sectionCode: "PER 16",
    domainFamily: "PER",
    sectionTitle: "Pre-Employment Eligibility",
    whatThisMeans:
      "Before someone starts work, your entity needs to check they are eligible to be employed and to be trusted with government information.",
    whyItMattersFallback:
      "Skipping eligibility checks can mean an unsuitable person gains access to sensitive work or information.",
    whatToDoNextFallback:
      "Check that pre-employment eligibility checks were completed and recorded for the people covered by this item."
  }),
  entry({
    sectionCode: "PER 17",
    domainFamily: "PER",
    sectionTitle: "Access to Resources",
    whatThisMeans:
      "People should only be given access to the systems, places, and information they actually need to do their job.",
    whyItMattersFallback:
      "Unnecessary access increases the chance of information being seen, changed, or removed by someone who should not have access.",
    whatToDoNextFallback:
      "Check who currently has access covered by this item and remove any access that is no longer needed."
  }),
  entry({
    sectionCode: "PER 18",
    domainFamily: "PER",
    sectionTitle: "Security Clearances",
    whatThisMeans:
      "People who need access to classified information or resources must hold the right level of security clearance for that access.",
    whyItMattersFallback:
      "Someone accessing classified material without the right clearance is a serious and reportable security problem.",
    whatToDoNextFallback:
      "Check that the security clearance level for this item matches what is actually needed, and follow up any mismatch."
  }),
  entry({
    sectionCode: "PER 19",
    domainFamily: "PER",
    sectionTitle: "Personnel Security Vetting Process",
    whatThisMeans: "Security clearances need to be assessed and granted through a proper, consistent vetting process.",
    whyItMattersFallback:
      "A vetting process that is not followed properly can let an unsuitable person be cleared, or delay a suitable person unfairly.",
    whatToDoNextFallback: "Check that the vetting process for this item was completed in full and is properly recorded."
  }),
  entry({
    sectionCode: "PER 21",
    domainFamily: "PER",
    sectionTitle: "Maintenance and Ongoing Assessment",
    whatThisMeans:
      "Once someone holds a clearance, your entity needs to keep checking that they remain suitable to hold it, not just check once at the start.",
    whyItMattersFallback:
      "A person's circumstances can change after they are cleared, and ongoing checks are how that change gets noticed.",
    whatToDoNextFallback: "Check when this ongoing assessment was last completed and arrange the next one if it is due."
  }),
  entry({
    sectionCode: "PER 22",
    domainFamily: "PER",
    sectionTitle: "Separation",
    whatThisMeans:
      "When someone leaves or changes role, your entity needs to remove their access and follow the right security steps for their departure.",
    whyItMattersFallback: "Access left in place after someone leaves is a common and avoidable security gap.",
    whatToDoNextFallback:
      "Check that access was removed and separation steps were completed for the person covered by this item."
  }),
  entry({
    sectionCode: "PHYS 23",
    domainFamily: "PHYS",
    sectionTitle: "Physical Security Lifecycle",
    whatThisMeans:
      "Your entity needs to manage the physical security of its buildings and facilities from planning through to day-to-day operation.",
    whyItMattersFallback:
      "Physical security that is not actively managed can weaken over time without anyone noticing.",
    whatToDoNextFallback:
      "Check when this facility or area was last reviewed for physical security and schedule a review if it is overdue."
  }),
  entry({
    sectionCode: "PHYS 24",
    domainFamily: "PHYS",
    sectionTitle: "Security Zones",
    whatThisMeans:
      "Areas that hold sensitive work or information need to be set up as a recognised security zone with the right level of protection.",
    whyItMattersFallback: "An area that is not properly zoned may not have the protection its contents actually need.",
    whatToDoNextFallback:
      "Check that the zone rating for this area matches what is stored or done there, and correct it if it does not."
  }),
  entry({
    sectionCode: "PHYS 25",
    domainFamily: "PHYS",
    sectionTitle: "Physical Security Measures and Controls",
    whatThisMeans:
      "Your entity needs practical physical measures in place — such as locks, alarms, and monitoring — matched to the sensitivity of what they protect.",
    whyItMattersFallback:
      "Missing or mismatched physical measures make it easier for someone to gain unauthorised physical access.",
    whatToDoNextFallback:
      "Check that the physical measures for this item are in place and working, and fix any that are not."
  })
];
