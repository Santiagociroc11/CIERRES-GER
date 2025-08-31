CREATE TABLE "public"."GERSSON_ASESORES" ( 
  "ID" SERIAL,
  "NOMBRE" VARCHAR(250) NOT NULL,
  "WHATSAPP" VARCHAR(250) NOT NULL,
  "LINK" INTEGER NOT NULL DEFAULT 0 ,
  "RECHAZADOS" INTEGER NOT NULL DEFAULT 0 ,
  "CARRITOS" INTEGER NOT NULL DEFAULT 0 ,
  "TICKETS" INTEGER NOT NULL DEFAULT 0 ,
  "COMPRAS" INTEGER NULL DEFAULT 0 ,
  "ES_ADMIN" BOOLEAN NULL DEFAULT false ,
  "ID_TG" VARCHAR NOT NULL,
  "MASIVOS" INTEGER NOT NULL DEFAULT 0 ,
  "PRIORIDAD" INTEGER NULL DEFAULT 1 ,
  "LIMITE_DIARIO" INTEGER NULL,
  "FECHA_INICIO_REGLA" BIGINT NULL,
  "FECHA_FIN_REGLA" BIGINT NULL,
  "HISTORIAL" JSON NULL,
  "current_weight" INTEGER NOT NULL DEFAULT 0 ,
  CONSTRAINT "GERSSON_ASESORES_pkey" PRIMARY KEY ("ID")
);
CREATE TABLE "public"."GERSSON_CLIENTES" ( 
  "ID" SERIAL,
  "NOMBRE" VARCHAR(250) NOT NULL,
  "ESTADO" VARCHAR(250) NOT NULL,
  "WHATSAPP" VARCHAR(250) NOT NULL,
  "ID_ASESOR" INTEGER NULL,
  "NOMBRE_ASESOR" VARCHAR(250) NULL,
  "WHA_ASESOR" VARCHAR(250) NULL,
  "FECHA_CREACION" VARCHAR(250) NOT NULL,
  "FECHA_COMPRA" VARCHAR(250) NULL,
  "MEDIO_COMPRA" VARCHAR(250) NULL,
  "MONTO_COMPRA" NUMERIC NULL,
  "MONEDA_COMPRA" TEXT NULL,
  "PAIS" VARCHAR(100) NULL,
  "soporte_tipo" VARCHAR(50) NULL,
  "soporte_prioridad" VARCHAR(20) NULL,
  "soporte_duda" VARCHAR(50) NULL,
  "soporte_descripcion" TEXT NULL,
  "soporte_fecha_ultimo" BIGINT NULL,
  CONSTRAINT "GERSSON_CLIENTES_pkey" PRIMARY KEY ("ID")
);
CREATE TABLE "public"."GERSSON_REGISTROS" ( 
  "ID" SERIAL,
  "ID_CLIENTE" INTEGER NOT NULL,
  "TIPO_EVENTO" VARCHAR(250) NULL,
  "FECHA_EVENTO" VARCHAR(250) NULL,
  CONSTRAINT "GERSSON_REGISTROS_pkey" PRIMARY KEY ("ID")
);
CREATE TABLE "public"."GERSSON_REPORTES" ( 
  "ID" SERIAL,
  "ID_CLIENTE" INTEGER NOT NULL,
  "ID_ASESOR" INTEGER NOT NULL,
  "ESTADO_ANTERIOR" VARCHAR(250) NULL,
  "ESTADO_NUEVO" VARCHAR(250) NOT NULL,
  "COMENTARIO" TEXT NULL,
  "FECHA_REPORTE" BIGINT NULL,
  "NOMBRE_ASESOR" VARCHAR(250) NOT NULL,
  "FECHA_SEGUIMIENTO" BIGINT NULL,
  "COMPLETADO" BOOLEAN NULL,
  "IMAGEN_CONVERSACION_URL" TEXT NULL,
  "IMAGEN_PAGO_URL" TEXT NULL,
  "PAIS_CLIENTE" VARCHAR(100) NULL,
  "CORREO_INSCRIPCION" VARCHAR(255) NULL,
  "TELEFONO_CLIENTE" VARCHAR(50) NULL,
  "CORREO_PAGO" VARCHAR(255) NULL,
  "MEDIO_PAGO" VARCHAR(100) NULL,
  "TIPO_VENTA" VARCHAR NULL,
  "consolidado" BOOLEAN NULL DEFAULT false ,
  "imagen_inicio_conversacion" TEXT NULL,
  "imagen_fin_conversacion" TEXT NULL,
  "video_conversacion" TEXT NULL,
  "PRODUCTO" VARCHAR(250) NULL,
  "verificada" BOOLEAN NULL DEFAULT false ,
  "estado_verificacion" VARCHAR(250) NULL,
  "comentario_rechazo" VARCHAR(250) NULL,
  "ACTIVIDAD_ECONOMICA" VARCHAR(100) NULL,
  "CEDULA_COMPRADOR" VARCHAR(50) NULL,
  "auditor1_decision" VARCHAR(250) NULL,
  "auditor1_comentario" TEXT NULL,
  "auditor1_timestamp" BIGINT NULL,
  "auditor1_id" VARCHAR(250) NULL,
  "auditor2_decision" VARCHAR(250) NULL,
  "auditor2_comentario" TEXT NULL,
  "auditor2_timestamp" BIGINT NULL,
  "auditor2_id" VARCHAR(250) NULL,
  "estado_doble_verificacion" VARCHAR(250) NULL DEFAULT 'pendiente_auditor1'::character varying ,
  "supervisor_resolution_timestamp" BIGINT NULL,
  "supervisor_resolution_comment" TEXT NULL,
  CONSTRAINT "GERSSON_REPORTES_pkey" PRIMARY KEY ("ID")
);
CREATE TABLE "public"."chat_quick_replies" ( 
  "id" SERIAL,
  "id_asesor" INTEGER NOT NULL,
  "texto" TEXT NOT NULL,
  "categoria" VARCHAR(50) NULL DEFAULT 'general'::character varying ,
  "orden" INTEGER NULL DEFAULT 0 ,
  "activo" BOOLEAN NULL DEFAULT true ,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "updated_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "chat_quick_replies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."chat_scheduled_messages" ( 
  "id" SERIAL,
  "id_asesor" INTEGER NOT NULL,
  "id_cliente" INTEGER NOT NULL,
  "wha_cliente" VARCHAR(30) NOT NULL,
  "mensaje" TEXT NOT NULL,
  "fecha_envio" TIMESTAMP WITH TIME ZONE NOT NULL,
  "estado" VARCHAR(20) NULL DEFAULT 'pendiente'::character varying ,
  "intentos" INTEGER NULL DEFAULT 0 ,
  "max_intentos" INTEGER NULL DEFAULT 3 ,
  "error_message" TEXT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "enviado_at" TIMESTAMP WITH TIME ZONE NULL,
  CONSTRAINT "chat_scheduled_messages_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."conversaciones" ( 
  "id" SERIAL,
  "id_asesor" INTEGER NOT NULL,
  "wha_cliente" VARCHAR(30) NOT NULL,
  "modo" VARCHAR(10) NOT NULL,
  "timestamp" BIGINT NOT NULL,
  "mensaje" TEXT NOT NULL,
  "id_cliente" INTEGER NULL,
  "mensaje_id" VARCHAR(255) NULL,
  "estado" VARCHAR(20) NULL,
  CONSTRAINT "conversaciones_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "public"."gersson_admins" ( 
  "id" UUID NOT NULL DEFAULT gen_random_uuid() ,
  "nombre" TEXT NOT NULL,
  "whatsapp" TEXT NOT NULL,
  "fecha_creacion" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "rol" VARCHAR(20) NOT NULL DEFAULT 'admin'::character varying ,
  CONSTRAINT "gersson_admins_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gersson_admins_whatsapp_key" UNIQUE ("whatsapp")
);
CREATE TABLE "public"."lid_mappings" ( 
  "id" SERIAL,
  "lid" VARCHAR(100) NOT NULL,
  "whatsapp_number" VARCHAR(20) NOT NULL,
  "id_cliente" INTEGER NULL,
  "asesor_id" INTEGER NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "last_seen" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  CONSTRAINT "lid_mappings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lid_mappings_lid_key" UNIQUE ("lid")
);
CREATE TABLE "public"."webhook_config" ( 
  "id" SERIAL,
  "platform" VARCHAR(50) NOT NULL,
  "config_key" VARCHAR(100) NOT NULL,
  "config_value" JSONB NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "updated_at" TIMESTAMP WITH TIME ZONE NULL DEFAULT now() ,
  "created_by" VARCHAR(100) NULL DEFAULT 'system'::character varying ,
  "updated_by" VARCHAR(100) NULL DEFAULT 'system'::character varying ,
  "is_active" BOOLEAN NULL DEFAULT true ,
  CONSTRAINT "webhook_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "webhook_config_platform_config_key_key" UNIQUE ("platform", "config_key")
);
CREATE TABLE "public"."webhook_logs" ( 
  "id" SERIAL,
  "event_type" VARCHAR(50) NOT NULL,
  "flujo" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'received'::character varying ,
  "buyer_name" VARCHAR(255) NULL,
  "buyer_email" VARCHAR(255) NULL,
  "buyer_phone" VARCHAR(50) NULL,
  "buyer_country" VARCHAR(100) NULL,
  "product_name" TEXT NULL,
  "transaction_id" VARCHAR(255) NULL,
  "purchase_amount" NUMERIC NULL,
  "purchase_date" TIMESTAMP NULL,
  "cliente_id" INTEGER NULL,
  "asesor_id" INTEGER NULL,
  "asesor_nombre" VARCHAR(255) NULL,
  "manychat_status" VARCHAR(20) NULL,
  "manychat_flow_id" VARCHAR(255) NULL,
  "manychat_subscriber_id" VARCHAR(255) NULL,
  "manychat_error" TEXT NULL,
  "flodesk_status" VARCHAR(20) NULL,
  "flodesk_segment_id" VARCHAR(255) NULL,
  "flodesk_error" TEXT NULL,
  "telegram_status" VARCHAR(20) NULL,
  "telegram_chat_id" VARCHAR(255) NULL,
  "telegram_message_id" VARCHAR(255) NULL,
  "telegram_error" TEXT NULL,
  "raw_webhook_data" JSONB NULL,
  "processing_time_ms" INTEGER NULL,
  "error_message" TEXT NULL,
  "error_stack" TEXT NULL,
  "received_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  "processed_at" TIMESTAMP NULL,
  "created_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  "updated_at" TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ,
  "processing_steps" JSONB NULL,
  CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_asesores_es_admin" 
ON "public"."GERSSON_ASESORES" (
  "ES_ADMIN" ASC
);
CREATE INDEX "idx_asesores_nombre" 
ON "public"."GERSSON_ASESORES" (
  "NOMBRE" ASC
);
CREATE INDEX "idx_asesores_id_tg" 
ON "public"."GERSSON_ASESORES" (
  "ID_TG" ASC
);
CREATE INDEX "idx_clientes_nombre" 
ON "public"."GERSSON_CLIENTES" (
  "NOMBRE" ASC
);
CREATE INDEX "idx_clientes_estado" 
ON "public"."GERSSON_CLIENTES" (
  "ESTADO" ASC
);
CREATE INDEX "idx_clientes_id_asesor" 
ON "public"."GERSSON_CLIENTES" (
  "ID_ASESOR" ASC
);
CREATE INDEX "idx_clientes_fecha_creacion" 
ON "public"."GERSSON_CLIENTES" (
  "FECHA_CREACION" ASC
);
CREATE INDEX "idx_clientes_asesor_fecha" 
ON "public"."GERSSON_CLIENTES" (
  "ID_ASESOR" ASC,
  "FECHA_CREACION" ASC
);
CREATE INDEX "idx_clientes_estado_fecha" 
ON "public"."GERSSON_CLIENTES" (
  "ESTADO" ASC,
  "FECHA_CREACION" ASC
);
CREATE INDEX "idx_gersson_clientes_soporte_prioridad" 
ON "public"."GERSSON_CLIENTES" (
  "soporte_prioridad" ASC
);
CREATE INDEX "idx_gersson_clientes_soporte_tipo" 
ON "public"."GERSSON_CLIENTES" (
  "soporte_tipo" ASC
);
CREATE INDEX "idx_registros_tipo_evento" 
ON "public"."GERSSON_REGISTROS" (
  "TIPO_EVENTO" ASC
);
CREATE INDEX "idx_registros_id_cliente" 
ON "public"."GERSSON_REGISTROS" (
  "ID_CLIENTE" ASC
);
CREATE INDEX "idx_registros_fecha_evento" 
ON "public"."GERSSON_REGISTROS" (
  "FECHA_EVENTO" ASC
);
CREATE INDEX "idx_registros_cliente_fecha" 
ON "public"."GERSSON_REGISTROS" (
  "ID_CLIENTE" ASC,
  "FECHA_EVENTO" ASC
);
CREATE INDEX "idx_cliente_asesor" 
ON "public"."GERSSON_REPORTES" (
  "ID_CLIENTE" ASC,
  "ID_ASESOR" ASC
);
CREATE INDEX "idx_reportes_consolidado" 
ON "public"."GERSSON_REPORTES" (
  "consolidado" ASC
);
CREATE INDEX "idx_reportes_asesor_fecha" 
ON "public"."GERSSON_REPORTES" (
  "ID_ASESOR" ASC,
  "FECHA_REPORTE" ASC
);
CREATE INDEX "idx_reportes_estado_nuevo" 
ON "public"."GERSSON_REPORTES" (
  "ESTADO_NUEVO" ASC
);
CREATE INDEX "idx_reportes_fecha_seguimiento" 
ON "public"."GERSSON_REPORTES" (
  "FECHA_SEGUIMIENTO" ASC
);
CREATE INDEX "idx_reportes_completado" 
ON "public"."GERSSON_REPORTES" (
  "COMPLETADO" ASC
);
CREATE INDEX "idx_reportes_asesor_fecha_reporte" 
ON "public"."GERSSON_REPORTES" (
  "ID_ASESOR" ASC,
  "FECHA_REPORTE" ASC
);
CREATE INDEX "idx_quick_replies_asesor" 
ON "public"."chat_quick_replies" (
  "id_asesor" ASC
);
CREATE INDEX "idx_quick_replies_categoria" 
ON "public"."chat_quick_replies" (
  "categoria" ASC
);
CREATE INDEX "idx_quick_replies_activo" 
ON "public"."chat_quick_replies" (
  "activo" ASC
);
CREATE INDEX "idx_scheduled_messages_fecha" 
ON "public"."chat_scheduled_messages" (
  "fecha_envio" ASC
);
CREATE INDEX "idx_scheduled_messages_estado" 
ON "public"."chat_scheduled_messages" (
  "estado" ASC
);
CREATE INDEX "idx_scheduled_messages_cliente" 
ON "public"."chat_scheduled_messages" (
  "id_cliente" ASC
);
CREATE INDEX "idx_scheduled_messages_asesor" 
ON "public"."chat_scheduled_messages" (
  "id_asesor" ASC
);
CREATE INDEX "idx_conversaciones_mensaje_id" 
ON "public"."conversaciones" (
  "mensaje_id" ASC
);
CREATE INDEX "idx_conversaciones_estado" 
ON "public"."conversaciones" (
  "estado" ASC
);
CREATE INDEX "idx_gersson_admins_rol" 
ON "public"."gersson_admins" (
  "rol" ASC
);
CREATE INDEX "idx_lid_mappings_lid" 
ON "public"."lid_mappings" (
  "lid" ASC
);
CREATE INDEX "idx_lid_mappings_whatsapp" 
ON "public"."lid_mappings" (
  "whatsapp_number" ASC
);
CREATE INDEX "idx_lid_mappings_cliente" 
ON "public"."lid_mappings" (
  "id_cliente" ASC
);
CREATE INDEX "idx_webhook_config_platform_key" 
ON "public"."webhook_config" (
  "platform" ASC,
  "config_key" ASC
);
CREATE INDEX "idx_webhook_config_active" 
ON "public"."webhook_config" (
  "is_active" ASC
);
CREATE INDEX "idx_webhook_logs_event_type" 
ON "public"."webhook_logs" (
  "event_type" ASC
);
CREATE INDEX "idx_webhook_logs_flujo" 
ON "public"."webhook_logs" (
  "flujo" ASC
);
CREATE INDEX "idx_webhook_logs_status" 
ON "public"."webhook_logs" (
  "status" ASC
);
CREATE INDEX "idx_webhook_logs_received_at" 
ON "public"."webhook_logs" (
  "received_at" DESC
);
CREATE INDEX "idx_webhook_logs_buyer_phone" 
ON "public"."webhook_logs" (
  "buyer_phone" ASC
);
CREATE INDEX "idx_webhook_logs_buyer_email" 
ON "public"."webhook_logs" (
  "buyer_email" ASC
);
CREATE INDEX "idx_webhook_logs_cliente_id" 
ON "public"."webhook_logs" (
  "cliente_id" ASC
);
CREATE INDEX "idx_webhook_logs_dashboard" 
ON "public"."webhook_logs" (
  "received_at" DESC,
  "status" ASC,
  "flujo" ASC
);
CREATE INDEX "idx_webhook_logs_processing_steps" 
ON "public"."webhook_logs" (
  "processing_steps" ASC
);
ALTER TABLE "public"."GERSSON_REGISTROS" ADD CONSTRAINT "GERSSON_REGISTROS_ID_CLIENTE_fkey" FOREIGN KEY ("ID_CLIENTE") REFERENCES "public"."GERSSON_CLIENTES" ("ID") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE FUNCTION "public"."get_current_user"() RETURNS TEXT LANGUAGE SQL
AS
$$

  SELECT current_user;

$$;
CREATE FUNCTION "public"."get_next_asesor_ponderado"() RETURNS INTEGER LANGUAGE PLPGSQL
AS
$$

DECLARE
  total_weight INTEGER;
  sel_id       INTEGER;
  now_epoch    BIGINT := FLOOR(EXTRACT(EPOCH FROM now()));
BEGIN
  ----------------------------------------------------------------
  -- 1) Calculamos la suma de prioridades SOLO de los no bloqueados
  ----------------------------------------------------------------
  SELECT SUM("PRIORIDAD")
    INTO total_weight
    FROM public."GERSSON_ASESORES"
   WHERE NOT (
     "FECHA_INICIO_REGLA" IS NOT NULL
     AND "FECHA_FIN_REGLA"  IS NOT NULL
     AND now_epoch BETWEEN "FECHA_INICIO_REGLA" AND "FECHA_FIN_REGLA"
   );

  ----------------------------------------------------------------
  -- 2) Aumentamos current_weight en prioridad para los mismos
  ----------------------------------------------------------------
  UPDATE public."GERSSON_ASESORES"
     SET "current_weight" = "current_weight" + "PRIORIDAD"
   WHERE NOT (
     "FECHA_INICIO_REGLA" IS NOT NULL
     AND "FECHA_FIN_REGLA"  IS NOT NULL
     AND now_epoch BETWEEN "FECHA_INICIO_REGLA" AND "FECHA_FIN_REGLA"
   );

  ----------------------------------------------------------------
  -- 3) Seleccionamos al asesor con mayor current_weight
  ----------------------------------------------------------------
  SELECT "ID"
    INTO sel_id
    FROM public."GERSSON_ASESORES"
   WHERE NOT (
     "FECHA_INICIO_REGLA" IS NOT NULL
     AND "FECHA_FIN_REGLA"  IS NOT NULL
     AND now_epoch BETWEEN "FECHA_INICIO_REGLA" AND "FECHA_FIN_REGLA"
   )
   ORDER BY "current_weight" DESC
   LIMIT 1;

  ----------------------------------------------------------------
  -- 4) Normalizamos restando total_weight al elegido
  ----------------------------------------------------------------
  UPDATE public."GERSSON_ASESORES"
     SET "current_weight" = "current_weight" - total_weight
   WHERE "ID" = sel_id;

  RETURN sel_id;
END;

$$;
CREATE FUNCTION "public"."get_processing_steps_stats"(IN days_back INTEGER, OUT step_name TEXT, OUT total_executions BIGINT, OUT success_count BIGINT, OUT error_count BIGINT, OUT avg_duration_ms NUMERIC) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

BEGIN
    RETURN QUERY
    WITH step_stats AS (
        SELECT 
            (step->>'step')::TEXT as step_name,
            COUNT(*) as executions,
            COUNT(*) FILTER (WHERE (step->>'status') = 'completed') as success_count,
            COUNT(*) FILTER (WHERE (step->>'status') = 'failed') as error_count
        FROM webhook_logs wl,
             jsonb_array_elements(wl.processing_steps) AS step
        WHERE wl.received_at >= CURRENT_DATE - (days_back || ' days')::INTERVAL
        AND wl.processing_steps IS NOT NULL
        GROUP BY (step->>'step')::TEXT
    )
    SELECT 
        ss.step_name,
        ss.executions,
        ss.success_count,
        ss.error_count,
        CASE 
            WHEN ss.executions > 0 THEN 
                (ss.success_count::NUMERIC / ss.executions::NUMERIC) * 100
            ELSE 0 
        END as avg_duration_ms
    FROM step_stats ss
    ORDER BY ss.executions DESC;
END;

$$;
CREATE FUNCTION "public"."get_webhook_config"(IN p_platform VARCHAR) RETURNS JSONB LANGUAGE PLPGSQL
AS
$$

DECLARE
    result JSONB := '{}';
    config_record RECORD;
BEGIN
    FOR config_record IN 
        SELECT config_key, config_value 
        FROM webhook_config 
        WHERE platform = p_platform AND is_active = true
    LOOP
        result := result || jsonb_build_object(config_record.config_key, config_record.config_value);
    END LOOP;
    
    RETURN result;
END;

$$;
CREATE FUNCTION "public"."increment_asesor_counter"(IN asesor_id INTEGER, IN counter_field TEXT) RETURNS VOID LANGUAGE PLPGSQL
AS
$$

BEGIN
    CASE counter_field
        WHEN 'CARRITOS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "CARRITOS" = "CARRITOS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'RECHAZADOS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "RECHAZADOS" = "RECHAZADOS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'TICKETS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "TICKETS" = "TICKETS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'COMPRAS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "COMPRAS" = "COMPRAS" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'LINK' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "LINK" = "LINK" + 1 
            WHERE "ID" = asesor_id;
        WHEN 'MASIVOS' THEN
            UPDATE "public"."GERSSON_ASESORES" 
            SET "MASIVOS" = "MASIVOS" + 1 
            WHERE "ID" = asesor_id;
    END CASE;
END;

$$;
CREATE FUNCTION "public"."reset_webhook_config"(IN p_platform VARCHAR) RETURNS BOOLEAN LANGUAGE PLPGSQL
AS
$$

BEGIN
    -- Deactivate current config
    UPDATE webhook_config 
    SET is_active = false, updated_at = NOW(), updated_by = 'system'
    WHERE platform = p_platform;
    
    -- Insert default config
    INSERT INTO webhook_config (platform, config_key, config_value, created_by)
    SELECT 
        platform, 
        config_key, 
        config_value, 
        'system'
    FROM webhook_config 
    WHERE platform = p_platform AND created_by = 'migration';
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;

$$;
CREATE FUNCTION "public"."search_webhook_logs_by_step"(IN step_name TEXT, OUT id BIGINT, OUT event_type VARCHAR, OUT flujo VARCHAR, OUT status VARCHAR, OUT step_info JSONB, OUT received_at TIMESTAMP) RETURNS RECORD LANGUAGE PLPGSQL
AS
$$

BEGIN
    RETURN QUERY
    SELECT 
        wl.id,
        wl.event_type,
        wl.flujo,
        wl.status,
        jsonb_array_elements(wl.processing_steps) AS step_info,
        wl.received_at
    FROM webhook_logs wl
    WHERE wl.processing_steps IS NOT NULL
    AND wl.processing_steps @> jsonb_build_array(jsonb_build_object('step', step_name))
    ORDER BY wl.received_at DESC;
END;

$$;
CREATE FUNCTION "public"."update_webhook_config"(IN p_platform VARCHAR, IN p_config_key VARCHAR, IN p_config_value JSONB, IN p_updated_by VARCHAR) RETURNS BOOLEAN LANGUAGE PLPGSQL
AS
$$

BEGIN
    INSERT INTO webhook_config (platform, config_key, config_value, updated_by)
    VALUES (p_platform, p_config_key, p_config_value, p_updated_by)
    ON CONFLICT (platform, config_key) 
    DO UPDATE SET 
        config_value = p_config_value,
        updated_at = NOW(),
        updated_by = p_updated_by;
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;

$$;
CREATE FUNCTION "public"."update_webhook_config_updated_at"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;

$$;
CREATE FUNCTION "public"."update_webhook_logs_updated_at"() RETURNS TRIGGER LANGUAGE PLPGSQL
AS
$$

BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;

$$;
CREATE VIEW "public"."recent_webhook_logs"
AS
 SELECT id,
    event_type,
    flujo,
    status,
    buyer_name,
    buyer_email,
    buyer_phone,
    product_name,
    transaction_id,
    cliente_id,
    asesor_nombre,
    manychat_status,
    flodesk_status,
    telegram_status,
    processing_time_ms,
    error_message,
    received_at,
    processed_at,
    processing_steps
   FROM webhook_logs
  ORDER BY received_at DESC
 LIMIT 1000;;
CREATE VIEW "public"."webhook_stats"
AS
 SELECT date(received_at) AS date,
    flujo,
    status,
    count(*) AS count,
    avg(processing_time_ms) AS avg_processing_time_ms,
    count(*) FILTER (WHERE ((manychat_status)::text = 'success'::text)) AS manychat_success,
    count(*) FILTER (WHERE ((manychat_status)::text = 'error'::text)) AS manychat_errors,
    count(*) FILTER (WHERE ((flodesk_status)::text = 'success'::text)) AS flodesk_success,
    count(*) FILTER (WHERE ((flodesk_status)::text = 'error'::text)) AS flodesk_errors,
    count(*) FILTER (WHERE ((telegram_status)::text = 'success'::text)) AS telegram_success,
    count(*) FILTER (WHERE ((telegram_status)::text = 'error'::text)) AS telegram_errors
   FROM webhook_logs
  WHERE (received_at >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY (date(received_at)), flujo, status
  ORDER BY (date(received_at)) DESC, flujo;;
