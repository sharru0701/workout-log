CREATE TABLE "dev"."account_deletion_tombstone" (
	"user_hash" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION "dev"."guard_deleted_account_write"()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
	scoped_user text;
BEGIN
	scoped_user := nullif(btrim(to_jsonb(NEW) ->> TG_ARGV[0]), '');
	IF scoped_user IS NULL THEN
		RETURN NEW;
	END IF;

	PERFORM pg_advisory_xact_lock_shared(hashtext('workout-account:' || scoped_user));
	IF EXISTS (
		SELECT 1
		FROM "dev"."account_deletion_tombstone"
		WHERE "user_hash" = md5(scoped_user)
	) THEN
		RAISE EXCEPTION USING
			ERRCODE = '23503',
			MESSAGE = 'account is no longer active';
	END IF;
	RETURN NEW;
END;
$function$;
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."program_template"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('owner_user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."plan"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."plan_runtime_state"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."generated_session"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."workout_log"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."plan_progress_event"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."stats_cache"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."user_setting"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."ux_event_log"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."auth_session"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."password_reset_token"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."email_verification_token"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "dev"."auth_oauth_account"
FOR EACH ROW EXECUTE FUNCTION "dev"."guard_deleted_account_write"('user_id');
