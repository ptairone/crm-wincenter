-- Create auth user and link to existing user record
DO $$
DECLARE
  v_user_id uuid := 'be5e9429-fe02-4bad-8191-88a78122eead';
  v_email text := 'alexrepresentantesc@gmail.com';
  v_password text := 'Fragafraga23#';
  v_auth_user_id uuid;
BEGIN
  -- Create user in auth.users using Supabase's internal function
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_auth_user_id;

  -- Link the auth user to the existing user record
  UPDATE public.users
  SET 
    auth_user_id = v_auth_user_id,
    role = 'admin',
    status = 'active',
    updated_at = NOW()
  WHERE id = v_user_id;

  -- Create identity record
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_auth_user_id,
    v_auth_user_id,
    jsonb_build_object('sub', v_auth_user_id, 'email', v_email),
    'email',
    NOW(),
    NOW(),
    NOW()
  );
END $$;