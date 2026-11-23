import { MigrationInterface, QueryRunner } from "typeorm";

export class DropLabelColumns1795423412080 implements MigrationInterface {
    name = 'DropLabelColumns1795423412080'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ---------- Hand-written: the engine views read the columns being dropped; rebuild them after ----------
        await queryRunner.query(`DROP VIEW engine_payment_rules`);
        await queryRunner.query(`DROP VIEW engine_contracts`);

        await queryRunner.query(`ALTER TABLE "contract_types" DROP CONSTRAINT "UQ_f1a211590a3ca925a8bd30b1def"`);
        await queryRunner.query(`ALTER TABLE "contract_types" DROP COLUMN "workflow_template"`);
        await queryRunner.query(`ALTER TABLE "contract_types" DROP CONSTRAINT "UQ_d1c73d0803f67709ff74b03e4d5"`);
        await queryRunner.query(`ALTER TABLE "contract_types" DROP COLUMN "rule_set_id"`);
        await queryRunner.query(`ALTER TABLE "contracts" DROP COLUMN "amended_end_date"`);

        // The Data Pack labels of a contract type, rebuilt from its rule sets for the engine (which only
        // checks the columns exist): rule set id = the part of the rule set codes before ":";
        // template name = WF_<middle word of the rule set id>_<number of rule sets>STAGE
        // (R_GOODS_STD with 4 rule sets -> WF_GOODS_4STAGE, as in the Data Pack).
        await queryRunner.query(`CREATE VIEW contract_type_labels AS
SELECT s.contract_type,
       split_part(min(s.release_rule_code), ':', 1) AS rule_set_id,
       'WF_' || split_part(split_part(min(s.release_rule_code), ':', 1), '_', 2) || '_' || count(*) || 'STAGE' AS workflow_template
FROM rule_scopes s GROUP BY s.contract_type`);
        await queryRunner.query(`CREATE VIEW engine_contracts AS
SELECT c.contract_id, c.contract_title, c.contract_type, c.buyer_id, c.supplier_id, c.contract_value_vnd_mn,
       'VND'::text AS currency, c.signing_date, c.start_date, c.end_date, l.workflow_template, l.rule_set_id,
       c.approval_policy, cardinality(approval_roles(c.approval_policy)) AS approval_quorum,
       (c.approval_policy = 'AUTO_IF_ALL_CONDITIONS') AS auto_release_allowed,
       c.grace_period_days, c.penalty_rate_pct_per_day, c.max_penalty_pct,
       'ACTIVE'::text AS initial_contract_status, (c.origin = 'DATA_PACK') AS data_is_synthetic,
       c.rule_version_id
FROM contracts c JOIN contract_type_labels l ON l.contract_type = c.contract_type`);
        await queryRunner.query(`CREATE VIEW engine_payment_rules AS
SELECT r.rule_id, l.rule_set_id, r.release_rule_code, l.workflow_template, s.contract_type,
       s.milestone_type AS applies_to_milestone_type, r.priority, 'ASCENDING_PRIORITY'::text AS evaluation_order,
       r.rule_name, r.rule_group, r.condition_expression, r.decision, r.reason_code, true AS stop_processing,
       r.payable_amount_formula, r.penalty_amount_formula,
       'milestones.csv:due_date,planned_payment_vnd_mn,approval_required,required_approval_quorum,late_penalty_applicable,grace_period_days,penalty_rate_pct_per_day,max_penalty_pct|required events from events.csv'::text AS parameter_source,
       r.rule_description_vi, r.active, (r.origin = 'DATA_PACK') AS data_is_synthetic, r.rule_version_id
FROM payment_rules r
JOIN rule_scopes s ON s.release_rule_code = r.release_rule_code
JOIN contract_type_labels l ON l.contract_type = s.contract_type`);
        // amended_end_date is gone: lifecycle is the only app-owned column of a Data Pack contract.
        await queryRunner.query(`DROP TRIGGER contracts_protect ON "contracts"`);
        await queryRunner.query(`CREATE TRIGGER contracts_protect BEFORE UPDATE OR DELETE ON "contracts" FOR EACH ROW EXECUTE FUNCTION protect_data_pack_row('lifecycle')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER contracts_protect ON "contracts"`);
        await queryRunner.query(`DROP VIEW engine_payment_rules`);
        await queryRunner.query(`DROP VIEW engine_contracts`);
        await queryRunner.query(`DROP VIEW contract_type_labels`);

        await queryRunner.query(`ALTER TABLE "contracts" ADD "amended_end_date" date`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD "rule_set_id" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD CONSTRAINT "UQ_d1c73d0803f67709ff74b03e4d5" UNIQUE ("rule_set_id")`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD "workflow_template" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "contract_types" ADD CONSTRAINT "UQ_f1a211590a3ca925a8bd30b1def" UNIQUE ("workflow_template")`);

        await queryRunner.query(`CREATE TRIGGER contracts_protect BEFORE UPDATE OR DELETE ON "contracts" FOR EACH ROW EXECUTE FUNCTION protect_data_pack_row('lifecycle', 'amended_end_date')`);
        await queryRunner.query(`CREATE VIEW engine_contracts AS
SELECT c.contract_id, c.contract_title, c.contract_type, c.buyer_id, c.supplier_id, c.contract_value_vnd_mn,
       'VND'::text AS currency, c.signing_date, c.start_date, c.end_date, t.workflow_template, t.rule_set_id,
       c.approval_policy, cardinality(approval_roles(c.approval_policy)) AS approval_quorum,
       (c.approval_policy = 'AUTO_IF_ALL_CONDITIONS') AS auto_release_allowed,
       c.grace_period_days, c.penalty_rate_pct_per_day, c.max_penalty_pct,
       'ACTIVE'::text AS initial_contract_status, (c.origin = 'DATA_PACK') AS data_is_synthetic,
       c.rule_version_id
FROM contracts c JOIN contract_types t ON t.code = c.contract_type`);
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

}
