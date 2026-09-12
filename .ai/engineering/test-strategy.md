# TEST STRATEGY

Status: draft
Owner: SDET Lead
Updated: <date> by <agent> - <reason>

## Philosophy
<What level of confidence this project needs and what you are willing to pay for it.
A prototype and a payments system deserve different answers - say which this is.>

## Pyramid

| Level | Scope | Tool | Target | Runs where |
|---|---|---|---|---|
| Unit | | | | |
| Integration | | | | |
| Contract | | | | |
| E2E | | | | |
| Manual / exploratory | | | | |

## Coverage targets
- Overall: <%>  ·  Critical paths: <%>  ·  Exempt: <paths and why>

## Requirement traceability

| Requirement | Test file | Test name |
|---|---|---|
| FR-001 | | |

## Fixtures and test data
<How test data is created, isolated, and cleaned up. Seed strategy. Factories.>

## What we deliberately do not test
<And why. Honesty here prevents fake coverage.>

## Anti-patterns banned in this repo
- Tests with no assertions
- Tests that mock the thing under test
- Snapshot tests updated reflexively on failure
- Tests that pass when the implementation is deleted
