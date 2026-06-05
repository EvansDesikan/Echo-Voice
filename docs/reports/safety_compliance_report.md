# Safety & Compliance Report — ECHO Voice
**Role:** Safety & Compliance Engineer
**Date:** 2026-06-05
**Status:** Approved for MVP pitch

---

## 1. Scope

I am responsible for ensuring ECHO Voice is lawful to operate in Germany/EU, psychologically safe for grieving families, and ethically sound in its treatment of deceased individuals' data.

---

## 2. GDPR Compliance Framework

### 2.1 Legal Basis for Processing

| Data Type | Legal Basis | Article |
|---|---|---|
| Voice recordings | Explicit consent (Art. 9 GDPR — biometric data) | Art. 9(2)(a) |
| Questionnaire responses | Explicit consent | Art. 6(1)(a) |
| Personal memories | Explicit consent | Art. 6(1)(a) |
| Conversation logs | Legitimate interest (service provision) | Art. 6(1)(f) |

**Critical:** Voice data is **biometric data** under GDPR Art. 9. It is a special category. Processing requires **explicit, separate, written consent** before any collection begins.

### 2.2 Consent Implementation

- Consent is collected at `/onboard/consent` — the gateway to all data collection
- Consent timestamp and IP are recorded in PostgreSQL (`clients.consent_ip`, `consent_timestamp`)
- Consent can be withdrawn at any time — deletion cascade removes all related records
- Consent form must include: purpose, data types, storage location, retention period, third-party processors (ElevenLabs, Anthropic), and right to erasure

### 2.3 Data Storage

- All data stored within EU (Germany preferred)
- MinIO deployment must be EU-hosted
- ElevenLabs: EU data processing addendum required before production use
- Anthropic: GDPR-compliant API — no training on API data by default (confirm DPA)

### 2.4 Data Retention Policy

| Data | Retention | Deletion Trigger |
|---|---|---|
| Voice recordings | Duration of service contract | Contract end + 30 days |
| ElevenLabs voice clone | Duration of service contract | Delete via API (`/voice/delete`) |
| Conversation logs | 2 years | Automatic purge |
| Questionnaire data | Duration of service contract | Contract end + 30 days |
| Memories (ChromaDB) | Duration of service contract | Full collection drop |

### 2.5 Right to Erasure (Art. 17 GDPR)

A client (or their estate executor) may request erasure. The system must:
1. Delete the ElevenLabs voice clone via API
2. Drop the ChromaDB memory collection
3. Delete all PostgreSQL records (cascade)
4. Delete all MinIO audio objects for that client_id

This flow must be a documented admin action in the danach.de staff dashboard.

---

## 3. Psychological Safety Framework

### 3.1 Population Context

Users are **actively grieving** people. This is a psychologically vulnerable population. The system must operate accordingly.

### 3.2 Safety Guardrails Implemented

| Guardrail | Implementation |
|---|---|
| AI disclosure | Persistent banner in UI: "Du sprichst mit einer KI, die auf [Name] basiert." |
| Session time limits | Default 30-minute soft limit; UI prompts a break |
| Crisis detection | Claude system prompt instructs agent to redirect to human support if crisis signals detected |
| No imitation of trauma | Agent must not replay traumatic events in graphic detail |
| No false promises | Agent cannot say "I'm still alive" or equivalent |
| Opt-out always visible | "Session beenden" button is permanently visible |

### 3.3 Crisis Response Protocol

If a family member's message contains signals of acute grief crisis, self-harm ideation, or similar, the agent's response must include:

> "Ich merke, dass du gerade durch etwas sehr Schweres gehst. Bitte wende dich an jemanden, der dir wirklich helfen kann — zum Beispiel die Telefonseelsorge: 0800 111 0 111 (kostenlos, 24/7)."

This is hardcoded as a retrieval-augmented guardrail, not purely LLM-generated.

### 3.4 Limitations Disclosure

The following must appear in the client onboarding agreement and family UI:

> "ECHO Voice ist ein KI-gestützter Gedenkdienst. Die KI-Person wurde auf Basis von Aufzeichnungen und Angaben von [Name] erstellt, kann jedoch irren, Dinge erfinden oder nicht so reagieren, wie [Name] es getan hätte. Bitte behandle ECHO Voice als Erinnerungshilfe, nicht als Ersatz für echte Trauerbegleitung."

---

## 4. Ethical Considerations

### 4.1 Consent of the Deceased

The fundamental ethical requirement is that **the person who is cloned must consent while alive**. ECHO Voice must not be used to create a voice agent of a deceased person without prior consent.

- Consent is collected during onboarding (Step 1 of the client journey)
- The service agreement explicitly states: "I consent to my voice, personality data, and memories being used to create an AI memorial companion."

### 4.2 Family Access Controls

- Only pre-approved family members (registered by the client during onboarding) can access the voice agent
- The client defines who can interact and sets any restrictions

### 4.3 Questionnaire Legal Disclaimer

The personality questionnaire is a **preference assessment** and does NOT constitute:
- A clinical psychological assessment
- A medical diagnosis
- A validated psychometric instrument for therapeutic use

The questionnaire is built for personality modelling in a memorial context. This must be disclosed to clients.

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ElevenLabs DPA not EU-compliant | Medium | High | Require signed DPA before production; fallback to Coqui XTTS (self-hosted) |
| Family member becomes dependent on AI for grief | Medium | High | 30-min session limits; recommend grief counsellor in onboarding |
| Voice clone misused by third party | Low | Very High | Session authentication; voice only accessible to approved family members |
| Agent says something harmful/false | Medium | High | Claude guardrails in system prompt; regular monitoring |
| GDPR erasure request not handled | Low | Very High | Documented admin deletion workflow with audit log |

---

## 6. Sign-Off

ECHO Voice MVP is cleared for pitch demo and limited pilot use, subject to:
1. EU-hosted deployment (all data residency requirements met)
2. ElevenLabs DPA executed
3. Anthropic API DPA reviewed
4. Legal review of consent form and service agreement by a German data protection lawyer before public launch

**Safety & Compliance Engineer — cleared.**
