CREATE TABLE "account_deletion_tombstone" (
	"user_hash" text PRIMARY KEY NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION "guard_deleted_account_write"()
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
		FROM "account_deletion_tombstone"
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
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "program_template"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('owner_user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "plan"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "plan_runtime_state"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "generated_session"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "workout_log"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "plan_progress_event"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "stats_cache"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "user_setting"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "ux_event_log"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "auth_session"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "password_reset_token"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "email_verification_token"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
--> statement-breakpoint
CREATE TRIGGER "account_lifecycle_write_guard" BEFORE INSERT OR UPDATE ON "auth_oauth_account"
FOR EACH ROW EXECUTE FUNCTION "guard_deleted_account_write"('user_id');
