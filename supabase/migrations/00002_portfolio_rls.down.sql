-- ロールバック: RLS ポリシー削除
DO $$
DECLARE
  t text;
  p text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'portfolio'
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'portfolio' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON portfolio.%I', p, t);
    END LOOP;
    EXECUTE format('ALTER TABLE portfolio.%I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;
