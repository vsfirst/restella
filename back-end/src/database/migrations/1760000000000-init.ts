import type { MigrationInterface, QueryRunner } from 'typeorm';

// 최초 스키마. 설계: docs/2-design/domain-model.md
// 제약을 정확히 통제하려고 SQL을 직접 쓴다. synchronize는 쓰지 않는다.
export class Init1760000000000 implements MigrationInterface {
  name = 'Init1760000000000';

  async up(q: QueryRunner): Promise<void> {
    const table = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    const timestamps = `
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`;

    await q.query(`
      CREATE TABLE room_type (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(100) NOT NULL,
        ${timestamps},
        PRIMARY KEY (id),
        UNIQUE KEY uk_room_type_code (code)
      ) ${table}`);

    await q.query(`
      CREATE TABLE inventory (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        room_type_id INT UNSIGNED NOT NULL,
        stay_date DATE NOT NULL,
        total_rooms INT NOT NULL,
        sold_rooms INT NOT NULL DEFAULT 0,
        revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
        ${timestamps},
        PRIMARY KEY (id),
        UNIQUE KEY uk_inventory_room_type_date (room_type_id, stay_date),
        CONSTRAINT fk_inventory_room_type FOREIGN KEY (room_type_id) REFERENCES room_type (id),
        -- NFR-01: 로직이 틀려도 초과 판매는 저장되지 않는다
        CONSTRAINT ck_inventory_total CHECK (total_rooms >= 0),
        CONSTRAINT ck_inventory_sold CHECK (sold_rooms >= 0 AND sold_rooms <= total_rooms)
      ) ${table}`);

    await q.query(`
      CREATE TABLE channel (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(100) NOT NULL,
        type ENUM('CONFIRM', 'NOTIFY') NOT NULL,
        endpoint_url VARCHAR(500) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        ${timestamps},
        PRIMARY KEY (id),
        UNIQUE KEY uk_channel_code (code)
      ) ${table}`);

    await q.query(`
      CREATE TABLE channel_availability (
        channel_id INT UNSIGNED NOT NULL,
        room_type_id INT UNSIGNED NOT NULL,
        stay_date DATE NOT NULL,
        desired_available INT NOT NULL,
        desired_revision BIGINT UNSIGNED NOT NULL,
        sent_available INT NULL,
        sent_revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
        changed_at DATETIME(3) NOT NULL,
        sent_at DATETIME(3) NULL,
        attempts INT NOT NULL DEFAULT 0,
        next_attempt_at DATETIME(3) NOT NULL,
        last_error VARCHAR(500) NULL,
        PRIMARY KEY (channel_id, room_type_id, stay_date),
        KEY ix_channel_availability_due (next_attempt_at),
        CONSTRAINT fk_channel_availability_channel FOREIGN KEY (channel_id) REFERENCES channel (id),
        CONSTRAINT fk_channel_availability_room_type FOREIGN KEY (room_type_id) REFERENCES room_type (id)
      ) ${table}`);

    await q.query(`
      CREATE TABLE operator (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        login_id VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        ${timestamps},
        PRIMARY KEY (id),
        UNIQUE KEY uk_operator_login_id (login_id)
      ) ${table}`);

    await q.query(`
      CREATE TABLE reservation (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        channel_id INT UNSIGNED NOT NULL,
        channel_reservation_no VARCHAR(64) NOT NULL,
        request_hash CHAR(64) NOT NULL,
        room_type_id INT UNSIGNED NOT NULL,
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        guest_name VARCHAR(100) NOT NULL,
        status ENUM('CONFIRMED', 'REJECTED', 'CONFLICT', 'CANCELLED') NOT NULL,
        initial_result ENUM('CONFIRMED', 'REJECTED', 'CONFLICT') NOT NULL,
        cancelled_at DATETIME(3) NULL,
        ${timestamps},
        PRIMARY KEY (id),
        -- REQ-08: 같은 채널의 같은 예약번호는 한 번만 처리한다
        UNIQUE KEY uk_reservation_channel_no (channel_id, channel_reservation_no),
        KEY ix_reservation_stay (check_in, check_out),
        KEY ix_reservation_status (status, created_at),
        CONSTRAINT fk_reservation_channel FOREIGN KEY (channel_id) REFERENCES channel (id),
        CONSTRAINT fk_reservation_room_type FOREIGN KEY (room_type_id) REFERENCES room_type (id),
        CONSTRAINT ck_reservation_stay CHECK (check_out > check_in)
      ) ${table}`);

    await q.query(`
      CREATE TABLE conflict (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        reservation_id INT UNSIGNED NOT NULL,
        status ENUM('OPEN', 'CANCELLED', 'RESOLVED', 'MOVED') NOT NULL DEFAULT 'OPEN',
        resolution_note VARCHAR(500) NULL,
        resolved_by INT UNSIGNED NULL,
        detected_at DATETIME(3) NOT NULL,
        resolved_at DATETIME(3) NULL,
        ${timestamps},
        PRIMARY KEY (id),
        UNIQUE KEY uk_conflict_reservation (reservation_id),
        KEY ix_conflict_status (status, detected_at),
        CONSTRAINT fk_conflict_reservation FOREIGN KEY (reservation_id) REFERENCES reservation (id),
        CONSTRAINT fk_conflict_operator FOREIGN KEY (resolved_by) REFERENCES operator (id)
      ) ${table}`);

    // 추가만 하는 기록. 대상이 바뀌거나 지워져도 남도록 외래 키를 걸지 않는다
    await q.query(`
      CREATE TABLE event_log (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        occurred_at DATETIME(3) NOT NULL,
        type ENUM(
          'RESERVATION_CONFIRMED', 'RESERVATION_REJECTED', 'RESERVATION_DUPLICATE',
          'RESERVATION_CONFLICT', 'RESERVATION_CANCELLED',
          'CONFLICT_CANCELLED', 'CONFLICT_RESOLVED', 'CONFLICT_MOVED',
          'INVENTORY_ADJUSTED', 'SYNC_SUCCEEDED', 'SYNC_FAILED'
        ) NOT NULL,
        actor VARCHAR(64) NOT NULL,
        reservation_id INT UNSIGNED NULL,
        channel_id INT UNSIGNED NULL,
        room_type_id INT UNSIGNED NULL,
        detail JSON NOT NULL,
        PRIMARY KEY (id),
        KEY ix_event_log_occurred (occurred_at),
        KEY ix_event_log_type (type, occurred_at)
      ) ${table}`);

    // 시뮬레이터 자신의 기록. 다른 도메인과 독립이라 외래 키를 걸지 않는다
    await q.query(`
      CREATE TABLE simulation_run (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        room_type_id INT UNSIGNED NOT NULL,
        check_in DATE NOT NULL,
        check_out DATE NOT NULL,
        request_count INT NOT NULL,
        notify_ratio INT NOT NULL,
        duplicate_ratio INT NOT NULL,
        prepare_remaining INT NULL,
        result JSON NULL,
        started_at DATETIME(3) NOT NULL,
        finished_at DATETIME(3) NULL,
        PRIMARY KEY (id)
      ) ${table}`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'simulation_run',
      'event_log',
      'conflict',
      'reservation',
      'operator',
      'channel_availability',
      'channel',
      'inventory',
      'room_type',
    ]) {
      await q.query(`DROP TABLE IF EXISTS ${t}`);
    }
  }
}
