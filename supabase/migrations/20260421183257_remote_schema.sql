


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_user_repo_metadata"() RETURNS TABLE("github_repo_id" bigint, "user_starred_repo_id" "uuid", "status" "text", "is_pinned" boolean, "notes" "text", "tag_ids" "uuid"[], "collection_ids" "uuid"[])
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    r.github_repo_id,
    usr.id as user_starred_repo_id,
    usr.status,
    usr.is_pinned,
    usr.notes,
    coalesce(array_agg(distinct usrt.tag_id) filter (where usrt.tag_id is not null), '{}'::uuid[]) as tag_ids,
    coalesce(array_agg(distinct usrc.collection_id) filter (where usrc.collection_id is not null), '{}'::uuid[]) as collection_ids
  from public.user_starred_repos usr
  join public.repos r
    on r.id = usr.repo_id
  left join public.user_starred_repo_tags usrt
    on usrt.user_starred_repo_id = usr.id
   and usrt.user_id = usr.user_id
  left join public.user_starred_repo_collections usrc
    on usrc.user_starred_repo_id = usr.id
   and usrc.user_id = usr.user_id
  where usr.user_id = auth.uid()
  group by r.github_repo_id, usr.id, usr.status, usr.is_pinned, usr.notes;
$$;


ALTER FUNCTION "public"."get_user_repo_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_valid_token"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return (
    select provider_token from public.profiles
    where id = p_user_id
      and provider_token is not null
      and (token_expires_at is null or token_expires_at > now())
  );
end;
$$;


ALTER FUNCTION "public"."get_valid_token"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, github_username, github_avatar_url, github_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'preferred_username', null),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null),
    coalesce(new.raw_user_meta_data ->> 'provider_id', null)
  )
  on conflict (id) do update set
    github_username = excluded.github_username,
    github_avatar_url = excluded.github_avatar_url,
    github_id = excluded.github_id;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."token_needs_refresh"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  return exists (
    select 1 from public.profiles
    where id = p_user_id
      and provider_token is not null
      and (token_expires_at is null or token_expires_at < now() + interval '30 minutes')
  );
end;
$$;


ALTER FUNCTION "public"."token_needs_refresh"("p_user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "emoji" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "collections_name_max_length" CHECK (("char_length"("name") <= 50))
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "github_username" "text",
    "github_avatar_url" "text",
    "github_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_github_sync_at" timestamp with time zone,
    "total_starred_count" integer DEFAULT 0 NOT NULL,
    "last_ai_categorization_at" timestamp with time zone,
    "ai_brief_week_start" timestamp with time zone,
    "ai_brief_count" integer DEFAULT 0 NOT NULL,
    "ai_intel_week_start" timestamp with time zone,
    "ai_intel_count" integer DEFAULT 0 NOT NULL,
    "last_contribution_scan_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repo_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repo_full_name" "text" NOT NULL,
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "health_score" integer,
    "maintenance_verdict" "text",
    "community_sentiment" "text",
    "adoption_readiness" "text",
    "top_pain_points" "jsonb",
    "summary" "text",
    "recommendation" "text",
    "metrics" "jsonb",
    CONSTRAINT "repo_insights_health_score_check" CHECK ((("health_score" >= 0) AND ("health_score" <= 100)))
);


ALTER TABLE "public"."repo_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."repo_star_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "repo_github_id" bigint NOT NULL,
    "owner" "text" NOT NULL,
    "name" "text" NOT NULL,
    "star_count" integer NOT NULL,
    "snapshot_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."repo_star_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "public"."repo_star_snapshots" IS 'Stores daily snapshots of star counts for repos to calculate velocity trends';



CREATE TABLE IF NOT EXISTS "public"."repos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "github_repo_id" bigint NOT NULL,
    "owner" "text" NOT NULL,
    "name" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "description" "text",
    "language" "text",
    "language_color" "text",
    "topics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "homepage" "text",
    "license" "text",
    "stargazers_count" integer DEFAULT 0 NOT NULL,
    "forks_count" integer DEFAULT 0 NOT NULL,
    "open_issues_count" integer DEFAULT 0 NOT NULL,
    "pushed_at" timestamp with time zone,
    "avatar_url" "text",
    "archived" boolean DEFAULT false NOT NULL,
    "readme" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."repos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tags_label_max_length" CHECK (("char_length"("label") <= 50))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_starred_repo_collections" (
    "user_starred_repo_id" "uuid" NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_starred_repo_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_starred_repo_tags" (
    "user_starred_repo_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_starred_repo_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_starred_repos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "repo_id" "uuid" NOT NULL,
    "starred_at" timestamp with time zone,
    "status" "text",
    "is_pinned" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_starred_repos_notes_max_length" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 5000))),
    CONSTRAINT "user_starred_repos_status_check" CHECK (("status" = ANY (ARRAY['want-to-try'::"text", 'currently-using'::"text", 'tried-liked'::"text", 'tried-dropped'::"text", 'just-interesting'::"text", 'reference'::"text"])))
);


ALTER TABLE "public"."user_starred_repos" OWNER TO "postgres";


ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_id_user_id_unique" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_github_id_key" UNIQUE ("github_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repo_insights"
    ADD CONSTRAINT "repo_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repo_insights"
    ADD CONSTRAINT "repo_insights_repo_full_name_key" UNIQUE ("repo_full_name");



ALTER TABLE ONLY "public"."repo_star_snapshots"
    ADD CONSTRAINT "repo_star_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repo_star_snapshots"
    ADD CONSTRAINT "repo_star_snapshots_repo_github_id_snapshot_date_key" UNIQUE ("repo_github_id", "snapshot_date");



ALTER TABLE ONLY "public"."repos"
    ADD CONSTRAINT "repos_github_repo_id_key" UNIQUE ("github_repo_id");



ALTER TABLE ONLY "public"."repos"
    ADD CONSTRAINT "repos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_id_user_id_unique" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_label_key" UNIQUE ("user_id", "label");



ALTER TABLE ONLY "public"."user_starred_repo_collections"
    ADD CONSTRAINT "user_starred_repo_collections_pkey" PRIMARY KEY ("user_starred_repo_id", "collection_id");



ALTER TABLE ONLY "public"."user_starred_repo_tags"
    ADD CONSTRAINT "user_starred_repo_tags_pkey" PRIMARY KEY ("user_starred_repo_id", "tag_id");



ALTER TABLE ONLY "public"."user_starred_repos"
    ADD CONSTRAINT "user_starred_repos_id_user_id_unique" UNIQUE ("id", "user_id");



ALTER TABLE ONLY "public"."user_starred_repos"
    ADD CONSTRAINT "user_starred_repos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_starred_repos"
    ADD CONSTRAINT "user_starred_repos_user_id_repo_id_key" UNIQUE ("user_id", "repo_id");



CREATE INDEX "idx_collections_user_id" ON "public"."collections" USING "btree" ("user_id");



CREATE INDEX "idx_repo_star_snapshots_date" ON "public"."repo_star_snapshots" USING "btree" ("snapshot_date");



CREATE INDEX "idx_repo_star_snapshots_repo_date" ON "public"."repo_star_snapshots" USING "btree" ("repo_github_id", "snapshot_date");



CREATE INDEX "idx_repo_star_snapshots_repo_id" ON "public"."repo_star_snapshots" USING "btree" ("repo_github_id");



CREATE INDEX "idx_repos_full_name" ON "public"."repos" USING "btree" ("full_name");



CREATE INDEX "idx_repos_github_repo_id" ON "public"."repos" USING "btree" ("github_repo_id");



CREATE INDEX "idx_tags_user_id" ON "public"."tags" USING "btree" ("user_id");



CREATE INDEX "idx_user_starred_repo_collections_user_starred_repo_id" ON "public"."user_starred_repo_collections" USING "btree" ("user_starred_repo_id");



CREATE INDEX "idx_user_starred_repo_tags_user_starred_repo_id" ON "public"."user_starred_repo_tags" USING "btree" ("user_starred_repo_id");



CREATE INDEX "idx_user_starred_repos_repo_id" ON "public"."user_starred_repos" USING "btree" ("repo_id");



CREATE INDEX "idx_user_starred_repos_starred_at" ON "public"."user_starred_repos" USING "btree" ("starred_at" DESC);



CREATE INDEX "idx_user_starred_repos_user_id" ON "public"."user_starred_repos" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_profiles_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_repos_update" BEFORE UPDATE ON "public"."repos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "on_user_starred_repos_update" BEFORE UPDATE ON "public"."user_starred_repos" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_collections"
    ADD CONSTRAINT "user_starred_repo_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_collections"
    ADD CONSTRAINT "user_starred_repo_collections_collection_owner_fkey" FOREIGN KEY ("collection_id", "user_id") REFERENCES "public"."collections"("id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_collections"
    ADD CONSTRAINT "user_starred_repo_collections_user_starred_repo_id_fkey" FOREIGN KEY ("user_starred_repo_id") REFERENCES "public"."user_starred_repos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_collections"
    ADD CONSTRAINT "user_starred_repo_collections_user_starred_repo_owner_fkey" FOREIGN KEY ("user_starred_repo_id", "user_id") REFERENCES "public"."user_starred_repos"("id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_tags"
    ADD CONSTRAINT "user_starred_repo_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_tags"
    ADD CONSTRAINT "user_starred_repo_tags_tag_owner_fkey" FOREIGN KEY ("tag_id", "user_id") REFERENCES "public"."tags"("id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_tags"
    ADD CONSTRAINT "user_starred_repo_tags_user_starred_repo_id_fkey" FOREIGN KEY ("user_starred_repo_id") REFERENCES "public"."user_starred_repos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repo_tags"
    ADD CONSTRAINT "user_starred_repo_tags_user_starred_repo_owner_fkey" FOREIGN KEY ("user_starred_repo_id", "user_id") REFERENCES "public"."user_starred_repos"("id", "user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repos"
    ADD CONSTRAINT "user_starred_repos_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_starred_repos"
    ADD CONSTRAINT "user_starred_repos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow insert from service role" ON "public"."repo_star_snapshots" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."repo_star_snapshots" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update from service role" ON "public"."repo_star_snapshots" FOR UPDATE TO "service_role" USING (true);



CREATE POLICY "Authenticated users can read repo insights" ON "public"."repo_insights" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role can manage repo insights" ON "public"."repo_insights" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "collections_delete_own" ON "public"."collections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "collections_insert_own" ON "public"."collections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "collections_select_own" ON "public"."collections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "collections_update_own" ON "public"."collections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."repo_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repo_star_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."repos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_delete_own" ON "public"."tags" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tags_insert_own" ON "public"."tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "tags_select_own" ON "public"."tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "tags_update_own" ON "public"."tags" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_starred_repo_collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_starred_repo_collections_delete_own" ON "public"."user_starred_repo_collections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_starred_repo_collections_insert_own" ON "public"."user_starred_repo_collections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_starred_repo_collections_select_own" ON "public"."user_starred_repo_collections" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_starred_repo_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_starred_repo_tags_delete_own" ON "public"."user_starred_repo_tags" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_starred_repo_tags_insert_own" ON "public"."user_starred_repo_tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_starred_repo_tags_select_own" ON "public"."user_starred_repo_tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_starred_repos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_starred_repos_select_own" ON "public"."user_starred_repos" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_starred_repos_update_own" ON "public"."user_starred_repos" FOR UPDATE USING (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































REVOKE ALL ON FUNCTION "public"."get_user_repo_metadata"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_repo_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_repo_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_repo_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_valid_token"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_valid_token"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_valid_token"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."token_needs_refresh"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."token_needs_refresh"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."token_needs_refresh"("p_user_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."repo_insights" TO "anon";
GRANT ALL ON TABLE "public"."repo_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."repo_insights" TO "service_role";



GRANT ALL ON TABLE "public"."repo_star_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."repo_star_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."repo_star_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."repos" TO "anon";
GRANT ALL ON TABLE "public"."repos" TO "authenticated";
GRANT ALL ON TABLE "public"."repos" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."user_starred_repo_collections" TO "anon";
GRANT ALL ON TABLE "public"."user_starred_repo_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_starred_repo_collections" TO "service_role";



GRANT ALL ON TABLE "public"."user_starred_repo_tags" TO "anon";
GRANT ALL ON TABLE "public"."user_starred_repo_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_starred_repo_tags" TO "service_role";



GRANT ALL ON TABLE "public"."user_starred_repos" TO "anon";
GRANT ALL ON TABLE "public"."user_starred_repos" TO "authenticated";
GRANT ALL ON TABLE "public"."user_starred_repos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































