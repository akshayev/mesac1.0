# ADR-0004: Approved-admin list with Google or email one-time code
Status: Accepted
Date: 2026-10-02 (proposal)

## Context
A few admins change every year. No password database should exist to leak. Free serverless plans make heavy password hashing awkward.

## Decision
Sign in with Google or an emailed one-time code. Only emails in the `admins` table (active) can enter. Any admin can add or remove admins. All admins have full access.

## Alternatives
Passwords with reset by email: rejected (leak risk, hashing cost). Role-based permissions: out of scope; the types still define three roles, to be resolved (see data-model.md).

## Consequences
- Needs an email service with a free tier and DNS access to the domain.
- Session cookies must be HttpOnly, Secure, SameSite; every admin endpoint verifies the session server-side.
- The current prototype mode must never reach production.
