/*
  # Add OTP codes table

  Persists OTP codes between request and verify calls so they survive across edge function instances.

  ## 1. New Tables

  ### `otp_codes`
  Short-lived OTP codes for the email + OTP sign-in flow.
    - `email` (text, primary key) — one active code per email at a time
    - `code` (text) — 6-digit code
    - `expires_at` (timestamptz) — codes expire after 10 minutes

  ## 2. Security

  RLS enabled. No public read or write — only the service role (edge functions) touches this table.
*/

CREATE TABLE IF NOT EXISTS otp_codes (
  email text PRIMARY KEY,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access to otp codes"
  ON otp_codes FOR SELECT
  TO authenticated
  USING (false);
