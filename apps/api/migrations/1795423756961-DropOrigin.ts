import { MigrationInterface, QueryRunner } from "typeorm";

export class DropOrigin1795423756961 implements MigrationInterface {
    name = 'DropOrigin1795423756961'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ---------- Hand-written: views and triggers that read origin go first ----------
        await queryRunner.query(`DROP VIEW engine_payment_rules`);
        await queryRunner.query(`DROP VIEW engine_milestones`);
        await queryRunner.query(`DROP VIEW engine_contracts`);
        await queryRunner.query(`DROP VIEW engine_parties`);
        await queryRunner.query(`DROP TRIGGER parties_protect ON "parties"`);
        await queryRunner.query(`DROP TRIGGER contracts_protect ON "contracts"`);
        await queryRunner.query(`DROP TRIGGER milestones_protect ON "milestones"`);
        await queryRunner.query(`DROP TRIGGER payment_rules_protect ON "payment_rules"`);
        // Data Pack rows are no longer locked: without origin there is nothing to tell them apart.
        await queryRunner.query(`DROP FUNCTION protect_data_pack_row()`);

        await queryRunner.query(`ALTER TABLE "contract_types" DROP CONSTRAINT "contract_types_origin_check"`);
        await queryRunner.query(`ALTER TABLE "rule_scopes" DROP CONSTRAINT "rule_scopes_origin_check"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP CONSTRAINT "payment_rules_origin_check"`);
        await queryRunner.query(`ALTER TABLE "rule_versions" DROP CONSTRAINT "rule_versions_origin_check"`);
        await queryRunner.query(`ALTER TABLE "parties" DROP CONSTRAINT "parties_origin_check"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_origin_check"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "milestones_origin_check"`);
        await queryRunner.query(`ALTER TABLE "contract_type_stages" DROP CONSTRAINT "stages_origin_check"`);
        await queryRunner.query(`ALTER TABLE "contract_types" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "rule_scopes" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "rule_versions" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "parties" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "origin"`);
        await queryRunner.query(`ALTER TABLE "contract_type_stages" DROP COLUMN "origin"`);

        // The engine only checks the column exists; every Data Pack row has TRUE.
        await queryRunner.query(`CREATE VIEW engine_parties AS SELECT party_id,
    party_name,
    party_type,
    parent_party_id,
    organization_category,
    region,
    'VN'::text AS country,
    approval_role,
    approval_level,
    approval_limit_vnd_mn,
    allowed_event_types,
    can_approve_payment,
    can_raise_dispute,
    status,
    true AS data_is_synthetic
   FROM parties p`);
        await queryRunner.query(`CREATE VIEW engine_contracts AS SELECT c.contract_id,
    c.contract_title,
    c.contract_type,
    c.buyer_id,
    c.supplier_id,
    c.contract_value_vnd_mn,
    'VND'::text AS currency,
    c.signing_date,
    c.start_date,
    c.end_date,
    l.workflow_template,
    l.rule_set_id,
    c.approval_policy,
    cardinality(approval_roles(c.approval_policy)) AS approval_quorum,
    c.approval_policy = 'AUTO_IF_ALL_CONDITIONS'::text AS auto_release_allowed,
    c.grace_period_days,
    c.penalty_rate_pct_per_day,
    c.max_penalty_pct,
    'ACTIVE'::text AS initial_contract_status,
    true AS data_is_synthetic,
    c.rule_version_id
   FROM contracts c
     JOIN contract_type_labels l ON l.contract_type = c.contract_type`);
        await queryRunner.query(`CREATE VIEW engine_milestones AS SELECT m.milestone_id,
    m.contract_id,
    m.milestone_sequence,
    s.milestone_type,
    m.milestone_name,
    m.due_date,
    round(m.planned_payment_vnd_mn * 100::numeric / NULLIF(c.contract_value_vnd_mn, 0::numeric), 2) AS payment_percent,
    m.planned_payment_vnd_mn,
    'ALL'::text AS condition_logic,
    m.required_event_types,
    array_to_string(((ARRAY( SELECT 'EVENT:'::text || e.e
           FROM unnest(m.required_event_types) e(e))) ||
        CASE
            WHEN cardinality(approval_roles(c.approval_policy)) > 0 THEN ARRAY['APPROVAL_QUORUM:'::text || cardinality(approval_roles(c.approval_policy))]
            ELSE '{}'::text[]
        END) || ARRAY['NO_OPEN_DISPUTE'::text], ' AND '::text) AS required_condition,
    m.invoice_required,
    cardinality(approval_roles(c.approval_policy)) > 0 AS approval_required,
    cardinality(approval_roles(c.approval_policy)) AS required_approval_quorum,
    approval_roles(c.approval_policy) AS required_approval_roles,
    true AS hold_on_open_dispute,
    m.late_penalty_applicable,
    c.grace_period_days,
        CASE
            WHEN m.late_penalty_applicable THEN c.penalty_rate_pct_per_day
            ELSE 0::numeric
        END AS penalty_rate_pct_per_day,
        CASE
            WHEN m.late_penalty_applicable THEN c.max_penalty_pct
            ELSE 0::numeric
        END AS max_penalty_pct,
    m.release_rule_code,
    'PLANNED'::text AS initial_milestone_status,
    true AS data_is_synthetic
   FROM milestones m
     JOIN contracts c ON c.contract_id = m.contract_id
     JOIN rule_scopes s ON s.release_rule_code = m.release_rule_code`);
        await queryRunner.query(`CREATE VIEW engine_payment_rules AS SELECT r.rule_id,
    l.rule_set_id,
    r.release_rule_code,
    l.workflow_template,
    s.contract_type,
    s.milestone_type AS applies_to_milestone_type,
    r.priority,
    'ASCENDING_PRIORITY'::text AS evaluation_order,
    r.rule_name,
    r.rule_group,
    r.condition_expression,
    r.decision,
    r.reason_code,
    true AS stop_processing,
    r.payable_amount_formula,
    r.penalty_amount_formula,
    'milestones.csv:due_date,planned_payment_vnd_mn,approval_required,required_approval_quorum,late_penalty_applicable,grace_period_days,penalty_rate_pct_per_day,max_penalty_pct|required events from events.csv'::text AS parameter_source,
    r.rule_description_vi,
    r.active,
    true AS data_is_synthetic,
    r.rule_version_id
   FROM payment_rules r
     JOIN rule_scopes s ON s.release_rule_code = r.release_rule_code
     JOIN contract_type_labels l ON l.contract_type = s.contract_type`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW engine_payment_rules`);
        await queryRunner.query(`DROP VIEW engine_milestones`);
        await queryRunner.query(`DROP VIEW engine_contracts`);
        await queryRunner.query(`DROP VIEW engine_parties`);

        await queryRunner.query(`ALTER TABLE "contract_type_stages" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "parties" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "rule_versions" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "rule_scopes" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD "origin" text NOT NULL DEFAULT 'APP'`);
        await queryRunner.query(`ALTER TABLE "contract_type_stages" ADD CONSTRAINT "stages_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "milestones_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "parties" ADD CONSTRAINT "parties_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "rule_versions" ADD CONSTRAINT "rule_versions_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD CONSTRAINT "payment_rules_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "rule_scopes" ADD CONSTRAINT "rule_scopes_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_origin_check" CHECK ((origin = ANY (ARRAY['DATA_PACK'::text, 'SEED'::text, 'APP'::text])))`);

        await queryRunner.query(`CREATE FUNCTION protect_data_pack_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE free text[] := TG_ARGV || ARRAY['version', 'updated_at'];
BEGIN
  IF OLD.origin = 'DATA_PACK' THEN
    IF TG_OP = 'DELETE' OR (to_jsonb(NEW) - free) IS DISTINCT FROM (to_jsonb(OLD) - free) THEN
      RAISE EXCEPTION 'DATA_PACK_ROW_IS_READ_ONLY: %', TG_TABLE_NAME USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$`);
        await queryRunner.query(`CREATE TRIGGER parties_protect BEFORE UPDATE OR DELETE ON "parties" FOR EACH ROW EXECUTE FUNCTION protect_data_pack_row()`);
        await queryRunner.query(`CREATE TRIGGER contracts_protect BEFORE UPDATE OR DELETE ON "contracts" FOR EACH ROW EXECUTE FUNCTION protect_data_pack_row('lifecycle')`);
        await queryRunner.query(`CREATE TRIGGER milestones_protect BEFORE UPDATE OR DELETE ON "milestones" FOR EACH ROW EXECUTE FUNCTION protect_data_pack_row()`);
        await queryRunner.query(`CREATE TRIGGER payment_rules_protect BEFORE UPDATE OR DELETE ON "payment_rules" FOR EACH ROW EXECUTE FUNCTION protect_data_pack_row()`);
        await queryRunner.query(`CREATE VIEW engine_parties AS SELECT party_id,
    party_name,
    party_type,
    parent_party_id,
    organization_category,
    region,
    'VN'::text AS country,
    approval_role,
    approval_level,
    approval_limit_vnd_mn,
    allowed_event_types,
    can_approve_payment,
    can_raise_dispute,
    status,
    origin = 'DATA_PACK'::text AS data_is_synthetic
   FROM parties p`);
        await queryRunner.query(`CREATE VIEW engine_contracts AS SELECT c.contract_id,
    c.contract_title,
    c.contract_type,
    c.buyer_id,
    c.supplier_id,
    c.contract_value_vnd_mn,
    'VND'::text AS currency,
    c.signing_date,
    c.start_date,
    c.end_date,
    l.workflow_template,
    l.rule_set_id,
    c.approval_policy,
    cardinality(approval_roles(c.approval_policy)) AS approval_quorum,
    c.approval_policy = 'AUTO_IF_ALL_CONDITIONS'::text AS auto_release_allowed,
    c.grace_period_days,
    c.penalty_rate_pct_per_day,
    c.max_penalty_pct,
    'ACTIVE'::text AS initial_contract_status,
    c.origin = 'DATA_PACK'::text AS data_is_synthetic,
    c.rule_version_id
   FROM contracts c
     JOIN contract_type_labels l ON l.contract_type = c.contract_type`);
        await queryRunner.query(`CREATE VIEW engine_milestones AS SELECT m.milestone_id,
    m.contract_id,
    m.milestone_sequence,
    s.milestone_type,
    m.milestone_name,
    m.due_date,
    round(m.planned_payment_vnd_mn * 100::numeric / NULLIF(c.contract_value_vnd_mn, 0::numeric), 2) AS payment_percent,
    m.planned_payment_vnd_mn,
    'ALL'::text AS condition_logic,
    m.required_event_types,
    array_to_string(((ARRAY( SELECT 'EVENT:'::text || e.e
           FROM unnest(m.required_event_types) e(e))) ||
        CASE
            WHEN cardinality(approval_roles(c.approval_policy)) > 0 THEN ARRAY['APPROVAL_QUORUM:'::text || cardinality(approval_roles(c.approval_policy))]
            ELSE '{}'::text[]
        END) || ARRAY['NO_OPEN_DISPUTE'::text], ' AND '::text) AS required_condition,
    m.invoice_required,
    cardinality(approval_roles(c.approval_policy)) > 0 AS approval_required,
    cardinality(approval_roles(c.approval_policy)) AS required_approval_quorum,
    approval_roles(c.approval_policy) AS required_approval_roles,
    true AS hold_on_open_dispute,
    m.late_penalty_applicable,
    c.grace_period_days,
        CASE
            WHEN m.late_penalty_applicable THEN c.penalty_rate_pct_per_day
            ELSE 0::numeric
        END AS penalty_rate_pct_per_day,
        CASE
            WHEN m.late_penalty_applicable THEN c.max_penalty_pct
            ELSE 0::numeric
        END AS max_penalty_pct,
    m.release_rule_code,
    'PLANNED'::text AS initial_milestone_status,
    m.origin = 'DATA_PACK'::text AS data_is_synthetic
   FROM milestones m
     JOIN contracts c ON c.contract_id = m.contract_id
     JOIN rule_scopes s ON s.release_rule_code = m.release_rule_code`);
        await queryRunner.query(`CREATE VIEW engine_payment_rules AS SELECT r.rule_id,
    l.rule_set_id,
    r.release_rule_code,
    l.workflow_template,
    s.contract_type,
    s.milestone_type AS applies_to_milestone_type,
    r.priority,
    'ASCENDING_PRIORITY'::text AS evaluation_order,
    r.rule_name,
    r.rule_group,
    r.condition_expression,
    r.decision,
    r.reason_code,
    true AS stop_processing,
    r.payable_amount_formula,
    r.penalty_amount_formula,
    'milestones.csv:due_date,planned_payment_vnd_mn,approval_required,required_approval_quorum,late_penalty_applicable,grace_period_days,penalty_rate_pct_per_day,max_penalty_pct|required events from events.csv'::text AS parameter_source,
    r.rule_description_vi,
    r.active,
    r.origin = 'DATA_PACK'::text AS data_is_synthetic,
    r.rule_version_id
   FROM payment_rules r
     JOIN rule_scopes s ON s.release_rule_code = r.release_rule_code
     JOIN contract_type_labels l ON l.contract_type = s.contract_type`);
    }

}
