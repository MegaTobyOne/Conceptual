# Workshop essentials vs specialist commands (ADR 0096 E7)

Per ADR 0096's "Workshop subtraction" slice, Workshop's command palette is not restructured or
hidden — every command below stays fully registered and invocable exactly as before. This
document classifies the 72 Workshop commands into an **essentials** set (day-to-day
assess-justify-act workflow: requirements, evidence, actions, risks, directions, relationships,
posture, reporting) and a **specialist** set (dashboards, integrations, AI assistance, strategy, questionnaires,
and reporting tools for power users). `scripts/check-workshop-essentials-commands.mjs` asserts this
list stays complete and accurate against `packages/workshop/package.json`, and that no two commands
across Core, Assurance, Workshop, Shop, and Pub share an exact palette title. ADR 0097 R1 (v1.71.0)
adds `pspf.workshop.openReportingWorkbench` to Essentials (71 → 72 commands, 24 → 25 essentials).

## Essentials (25)

- `pspf.workshop.openHome`
- `pspf.workshop.openWelcome`
- `pspf.workshop.createRequirement`
- `pspf.workshop.attachEvidence`
- `pspf.workshop.createAction`
- `pspf.workshop.createRisk`
- `pspf.workshop.openRequirementsList`
- `pspf.workshop.openEvidenceList`
- `pspf.workshop.openActionsList`
- `pspf.workshop.openRisksList`
- `pspf.workshop.openDirectionsList`
- `pspf.workshop.linkExistingEvidence`
- `pspf.workshop.linkExistingAction`
- `pspf.workshop.linkExistingRisk`
- `pspf.workshop.linkExistingDirection`
- `pspf.workshop.registerDirection`
- `pspf.workshop.updateDirectionResponse`
- `pspf.workshop.openDirectionDetail`
- `pspf.workshop.openConnectedView`
- `pspf.workshop.openItemDetail`
- `pspf.workshop.openTreeEntity`
- `pspf.workshop.copyPostureBrief`
- `pspf.workshop.openReportingWorkbench`
- `pspf.workshop.importBundle`
- `pspf.workshop.exportBackupJson`

## Specialist (47)

- `pspf.workshop.loadSampleWorkspace`
- `pspf.workshop.loadHomeSampleWorkspace`
- `pspf.workshop.exportTeamShareBundle`
- `pspf.workshop.importBackupJson`
- `pspf.workshop.aiDraftRequirementFromInterview`
- `pspf.workshop.aiSuggestIsmMappings`
- `pspf.workshop.createRoadmapInitiativePlan`
- `pspf.workshop.addPlannerTask`
- `pspf.workshop.addPlannerMilestone`
- `pspf.workshop.openRiskSourcePanel`
- `pspf.workshop.configureRiskSource`
- `pspf.workshop.openRiskSourceSettings`
- `pspf.workshop.setRiskSourceCredential`
- `pspf.workshop.testRiskSource`
- `pspf.workshop.previewRiskSourceImport`
- `pspf.workshop.applyRiskSourceImport`
- `pspf.workshop.viewRiskSourceRuns`
- `pspf.workshop.openAssessmentDashboard`
- `pspf.workshop.openMasterDashboard`
- `pspf.workshop.openPspfGridView`
- `pspf.workshop.openCyberAwarenessChangeStrategy`
- `pspf.workshop.openPentestWorkbench`
- `pspf.workshop.openRequirementCardView`
- `pspf.workshop.openEssentialEightDashboard`
- `pspf.workshop.openPlanOfActionBoard`
- `pspf.workshop.openStrategyMap`
- `pspf.workshop.editStrategySummary`
- `pspf.workshop.openEvidenceReviewQueue`
- `pspf.workshop.browseIsmSourceControls`
- `pspf.workshop.openIsmReviewWorkbench`
- `pspf.workshop.createRequirementControlMapping`
- `pspf.workshop.openChangeRecords`
- `pspf.workshop.recordSignificantChange`
- `pspf.workshop.manageTags`
- `pspf.workshop.manageSavedViews`
- `pspf.workshop.applyTag`
- `pspf.workshop.removeTag`
- `pspf.workshop.filterRequirementsByTag`
- `pspf.workshop.openCisoNewsletterReview`
- `pspf.workshop.openCisoMagazine`
- `pspf.workshop.copyCisoMagazine`
- `pspf.workshop.exportCisoMagazine`
- `pspf.workshop.openCisoMasterPlan`
- `pspf.workshop.copyCisoMasterPlan`
- `pspf.workshop.runQuickstartQuestionnaire`
- `pspf.workshop.runDomainDeepDive`
- `pspf.workshop.openQuestionnaireHistory`

## Retired (ADR 0096 E7)

These three specialist Workshop panels and their commands were removed entirely (not demoted):

- `pspf.workshop.openHumanCentredRiskView` (Human-Centred Risk View)
- `pspf.workshop.openContinuousComplianceMetro` (Continuous Compliance Metro)
- `pspf.workshop.openUnifiedSecurityOperatingModel` (Unified Security Operating Model)
