from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    group_id: str
    device_id: str
    mqtt_host: str = "127.0.0.1"
    mqtt_port: int = 1883
    mqtt_username: str
    mqtt_password: str
    influx_url: str = "http://127.0.0.1:8086"
    influx_org: str
    influx_bucket: str
    influx_token: str
    ui_operator_password: str
    topic_prefix: str = "bca182"
    command_ack_timeout_seconds: float = 2.0

    @property
    def topic_root(self) -> str:
        return f"{self.topic_prefix}/{self.group_id}/{self.device_id}"


settings = Settings()

