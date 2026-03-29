

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





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cuisines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."cuisines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dishes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_id" "uuid",
    "name" "text" NOT NULL,
    "comments" "text",
    "image_url" "text"
);


ALTER TABLE "public"."dishes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dish_id" "uuid",
    "user_id" "uuid",
    "rating" integer,
    "comments" "text",
    "order_type" "text" DEFAULT 'delivery'::"text",
    "date_rated" "date" DEFAULT CURRENT_DATE,
    CONSTRAINT "ratings_order_type_check" CHECK (("order_type" = ANY (ARRAY['delivery'::"text", 'in-person'::"text"]))),
    CONSTRAINT "ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "cuisine_id" "uuid",
    "rating" integer,
    CONSTRAINT "restaurants_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."restaurants"."rating" IS 'Restaurant Rating';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cuisines"
    ADD CONSTRAINT "cuisines_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."cuisines"
    ADD CONSTRAINT "cuisines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dishes"
    ADD CONSTRAINT "dishes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dishes"
    ADD CONSTRAINT "dishes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id");



ALTER TABLE ONLY "public"."ratings"
    ADD CONSTRAINT "ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_cuisine_id_fkey" FOREIGN KEY ("cuisine_id") REFERENCES "public"."cuisines"("id");



CREATE POLICY "Allow delete for authenticated users" ON "public"."dishes" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow delete for authenticated users" ON "public"."ratings" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow delete for authenticated users" ON "public"."restaurants" FOR DELETE TO "authenticated" USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow inserting cuisines" ON "public"."cuisines" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting dishes" ON "public"."dishes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting ratings" ON "public"."ratings" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting restaurants" ON "public"."restaurants" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow inserting users" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow selecting cuisines" ON "public"."cuisines" FOR SELECT USING (true);



CREATE POLICY "Allow selecting dishes" ON "public"."dishes" FOR SELECT USING (true);



CREATE POLICY "Allow selecting ratings" ON "public"."ratings" FOR SELECT USING (true);



CREATE POLICY "Allow selecting restaurants" ON "public"."restaurants" FOR SELECT USING (true);



CREATE POLICY "Allow selecting users" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Allow updates to cuisines" ON "public"."cuisines" FOR UPDATE USING (true);



CREATE POLICY "Allow updates to dishes" ON "public"."dishes" FOR UPDATE USING (true);



CREATE POLICY "Allow updates to ratings" ON "public"."ratings" FOR UPDATE USING (true);



CREATE POLICY "Allow updates to restaurants" ON "public"."restaurants" FOR UPDATE USING (true);



CREATE POLICY "Allow updates to users" ON "public"."users" FOR UPDATE USING (true);



ALTER TABLE "public"."cuisines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dishes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON TABLE "public"."cuisines" TO "anon";
GRANT ALL ON TABLE "public"."cuisines" TO "authenticated";
GRANT ALL ON TABLE "public"."cuisines" TO "service_role";



GRANT ALL ON TABLE "public"."dishes" TO "anon";
GRANT ALL ON TABLE "public"."dishes" TO "authenticated";
GRANT ALL ON TABLE "public"."dishes" TO "service_role";



GRANT ALL ON TABLE "public"."ratings" TO "anon";
GRANT ALL ON TABLE "public"."ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."ratings" TO "service_role";



GRANT ALL ON TABLE "public"."restaurants" TO "anon";
GRANT ALL ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























drop extension if exists "pg_net";


  create policy "Allow authenticated select/insert/update/delete d6h1xn_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'dish-images'::text));



  create policy "Allow authenticated select/insert/update/delete d6h1xn_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'dish-images'::text));



  create policy "Allow authenticated select/insert/update/delete d6h1xn_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'dish-images'::text));



  create policy "Allow authenticated select/insert/update/delete d6h1xn_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'dish-images'::text));



