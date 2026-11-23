import { MigrationInterface, QueryRunner } from "typeorm";

export class DropRecomputableColumns1795422620654 implements MigrationInterface {
    name = 'DropRecomputableColumns1795422620654'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "FK_bf194ebb2532bb92eea0d97c5a0"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_currency_check"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "milestones_numbers_check"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "milestones_logic_check"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP CONSTRAINT "milestones_percent_check"`);
        await queryRunner.query(`ALTER TABLE "contract_types" DROP CONSTRAINT "contract_types_code_template_rule_set_key"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "rule_set_id"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "workflow_template"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "contract_type"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "applies_to_milestone_type"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "evaluation_order"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "stop_processing"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "parameter_source"`);
        await queryRunner.query(`ALTER TABLE "payment_rules" DROP COLUMN "data_is_synthetic"`);
        await queryRunner.query(`ALTER TABLE "parties" DROP COLUMN "country"`);
        await queryRunner.query(`ALTER TABLE "parties" DROP COLUMN "data_is_synthetic"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "currency"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "workflow_template"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "rule_set_id"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "approval_quorum"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "auto_release_allowed"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "initial_contract_status"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "data_is_synthetic"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "milestone_type"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "payment_percent"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "condition_logic"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "required_condition"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "approval_required"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "required_approval_quorum"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "required_approval_roles"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "hold_on_open_dispute"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "grace_period_days"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "penalty_rate_pct_per_day"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "max_penalty_pct"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "initial_milestone_status"`);
        await queryRunner.query(`ALTER TABLE "milestones" DROP COLUMN "data_is_synthetic"`);
        await queryRunner.query(`COMMENT ON COLUMN "contracts"."contract_type" IS 'Loại hợp đồng (khóa ngoại tới contract_types); khuôn mốc và bộ luật lấy từ loại.'`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contract_type_fkey" FOREIGN KEY ("contract_type") REFERENCES "contract_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE`);


        // Dropping approval_quorum also drops the CHECK that mentioned it; restore it without that column.
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_numbers_check" CHECK ("grace_period_days" >= 0 AND "penalty_rate_pct_per_day" >= 0 AND "max_penalty_pct" >= 0)`);

        // ---------- Hand-written: rebuild the Data Pack columns for the engine ----------
        // Approver roles of an approval policy (Data Pack convention); the quorum is their count.
        await queryRunner.query(`CREATE FUNCTION approval_roles(policy text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE policy
    WHEN 'AUTO_IF_ALL_CONDITIONS' THEN '{}'::text[]
    WHEN 'SINGLE_BUYER_APPROVAL' THEN '{CONTRACT_OWNER}'::text[]
    WHEN 'DUAL_APPROVAL' THEN '{CONTRACT_OWNER,SECONDARY_APPROVER}'::text[]
    WHEN 'FINANCE_PLUS_OWNER' THEN '{CONTRACT_OWNER,FINANCE_APPROVER}'::text[]
  END $$`);

        // The engine reads exactly the organiser's columns; these views rebuild the ones not stored.
        await queryRunner.query(`CREATE VIEW engine_parties AS
SELECT p.party_id, p.party_name, p.party_type, p.parent_party_id, p.organization_category, p.region,
       'VN'::text AS country, p.approval_role, p.approval_level, p.approval_limit_vnd_mn, p.allowed_event_types,
       p.can_approve_payment, p.can_raise_dispute, p.status, (p.origin = 'DATA_PACK') AS data_is_synthetic
FROM parties p`);

        await queryRunner.query(`CREATE VIEW engine_contracts AS
SELECT c.contract_id, c.contract_title, c.contract_type, c.buyer_id, c.supplier_id, c.contract_value_vnd_mn,
       'VND'::text AS currency, c.signing_date, c.start_date, c.end_date, t.workflow_template, t.rule_set_id,
       c.approval_policy, cardinality(approval_roles(c.approval_policy)) AS approval_quorum,
       (c.approval_policy = 'AUTO_IF_ALL_CONDITIONS') AS auto_release_allowed,
       c.grace_period_days, c.penalty_rate_pct_per_day, c.max_penalty_pct,
       'ACTIVE'::text AS initial_contract_status, (c.origin = 'DATA_PACK') AS data_is_synthetic,
       c.rule_version_id
FROM contracts c JOIN contract_types t ON t.code = c.contract_type`);

        await queryRunner.query(`CREATE VIEW engine_milestones AS
SELECT m.milestone_id, m.contract_id, m.milestone_sequence, s.milestone_type, m.milestone_name, m.due_date,
       round(m.planned_payment_vnd_mn * 100 / NULLIF(c.contract_value_vnd_mn, 0), 2) AS payment_percent,
       m.planned_payment_vnd_mn, 'ALL'::text AS condition_logic, m.required_event_types,
       array_to_string(
         ARRAY(SELECT 'EVENT:' || e FROM unnest(m.required_event_types) AS e)
         || CASE WHEN cardinality(approval_roles(c.approval_policy)) > 0
                 THEN ARRAY['APPROVAL_QUORUM:' || cardinality(approval_roles(c.approval_policy))] ELSE '{}'::text[] END
         || ARRAY['NO_OPEN_DISPUTE'], ' AND ') AS required_condition,
       m.invoice_required,
       cardinality(approval_roles(c.approval_policy)) > 0 AS approval_required,
       cardinality(approval_roles(c.approval_policy)) AS required_approval_quorum,
       approval_roles(c.approval_policy) AS required_approval_roles,
       true AS hold_on_open_dispute, m.late_penalty_applicable, c.grace_period_days,
       CASE WHEN m.late_penalty_applicable THEN c.penalty_rate_pct_per_day ELSE 0 END AS penalty_rate_pct_per_day,
       CASE WHEN m.late_penalty_applicable THEN c.max_penalty_pct ELSE 0 END AS max_penalty_pct,
       m.release_rule_code, 'PLANNED'::text AS initial_milestone_status, (m.origin = 'DATA_PACK') AS data_is_synthetic
FROM milestones m
JOIN contracts c ON c.contract_id = m.contract_id
JOIN rule_scopes s ON s.release_rule_code = m.release_rule_code`);

        await queryRunner.query(`CREATE VIEW engine_payment_rules AS
SELECT r.rule_id, t.rule_set_id, r.release_rule_code, t.workflow_template, s.contract_type,
       s.milestone_type AS applies_to_milestone_type, r.priority, 'ASCENDING_PRIORITY'::text AS evaluation_order,
       r.rule_name, r.rule_group, r.condition_expression, r.decision, r.reason_code, true AS stop_processing,
       r.payable_amount_formula, r.penalty_amount_formula,
       'milestones.csv:due_date,planned_payment_vnd_mn,approval_required,required_approval_quorum,late_penalty_applicable,grace_period_days,penalty_rate_pct_per_day,max_penalty_pct|required events from events.csv'::text AS parameter_source,
       r.rule_description_vi, r.active, (r.origin = 'DATA_PACK') AS data_is_synthetic, r.rule_version_id
FROM payment_rules r
JOIN rule_scopes s ON s.release_rule_code = r.release_rule_code
JOIN contract_types t ON t.code = s.contract_type`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_numbers_check"`);
        await queryRunner.query(`DROP VIEW engine_payment_rules`);
        await queryRunner.query(`DROP VIEW engine_milestones`);
        await queryRunner.query(`DROP VIEW engine_contracts`);
        await queryRunner.query(`DROP VIEW engine_parties`);
        await queryRunner.query(`DROP FUNCTION approval_roles(text)`);

        await queryRunner.query(`ALTER TABLE "contracts" DROP CONSTRAINT "contracts_contract_type_fkey"`);
        await queryRunner.query(`COMMENT ON COLUMN "contracts"."contract_type" IS 'Loại hợp đồng (khóa ngoại tới contract_types cùng workflow_template và rule_set_id).'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "data_is_synthetic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "initial_milestone_status" text NOT NULL DEFAULT 'PLANNED'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "max_penalty_pct" numeric(7,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "penalty_rate_pct_per_day" numeric(7,4) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "grace_period_days" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "hold_on_open_dispute" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "required_approval_roles" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "required_approval_quorum" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "approval_required" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "required_condition" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "condition_logic" text NOT NULL DEFAULT 'ALL'`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "payment_percent" numeric(5,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD "milestone_type" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "data_is_synthetic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "initial_contract_status" text NOT NULL DEFAULT 'ACTIVE'`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "auto_release_allowed" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "approval_quorum" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "rule_set_id" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "workflow_template" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD "currency" text NOT NULL DEFAULT 'VND'`);
        await queryRunner.query(`ALTER TABLE "parties" ADD "data_is_synthetic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "parties" ADD "country" text NOT NULL DEFAULT 'VN'`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "data_is_synthetic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "parameter_source" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "stop_processing" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "evaluation_order" text NOT NULL DEFAULT 'ASCENDING_PRIORITY'`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "applies_to_milestone_type" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "contract_type" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "workflow_template" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payment_rules" ADD "rule_set_id" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD CONSTRAINT "contract_types_code_template_rule_set_key" UNIQUE ("code", "rule_set_id", "workflow_template")`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "milestones_percent_check" CHECK (((payment_percent >= (0)::numeric) AND (payment_percent <= (100)::numeric)))`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "milestones_logic_check" CHECK ((condition_logic = 'ALL'::text))`);
        await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "milestones_numbers_check" CHECK (((required_approval_quorum >= 0) AND (grace_period_days >= 0) AND (penalty_rate_pct_per_day >= (0)::numeric) AND (max_penalty_pct >= (0)::numeric)))`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "contracts_currency_check" CHECK ((currency = 'VND'::text))`);
        await queryRunner.query(`ALTER TABLE "contracts" ADD CONSTRAINT "FK_bf194ebb2532bb92eea0d97c5a0" FOREIGN KEY ("contract_type", "workflow_template", "rule_set_id") REFERENCES "contract_types"("code","workflow_template","rule_set_id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    }

}
