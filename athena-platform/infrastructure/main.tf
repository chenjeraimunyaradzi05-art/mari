provider "aws" {
  region = var.primary_region
}

provider "aws" {
  alias  = "us"
  region = var.us_region
}

provider "aws" {
  alias  = "sea"
  region = var.sea_region
}

provider "aws" {
  alias  = "mea"
  region = var.mea_region
}

# --- VPC & Networking ---
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "athena-vpc"
  }
}

resource "aws_vpc" "us" {
  provider   = aws.us
  count      = var.enable_us_region ? 1 : 0
  cidr_block = "10.10.0.0/16"
  tags = {
    Name = "athena-vpc-us"
  }
}

resource "aws_vpc" "sea" {
  provider   = aws.sea
  count      = var.enable_sea_region ? 1 : 0
  cidr_block = "10.20.0.0/16"
  tags = {
    Name = "athena-vpc-sea"
  }
}

resource "aws_vpc" "mea" {
  provider   = aws.mea
  count      = var.enable_mea_region ? 1 : 0
  cidr_block = "10.30.0.0/16"
  tags = {
    Name = "athena-vpc-mea"
  }
}

# --- Database (RDS MySQL) ---
resource "aws_db_instance" "default" {
  allocated_storage    = 20
  storage_type         = "gp2"
  engine               = "mysql"
  engine_version       = "8.0"
  instance_class       = "db.t3.micro"
  db_name              = "athena_prod"
  username             = "admin"
  password             = var.db_password
  parameter_group_name = "default.mysql8.0"
  skip_final_snapshot  = true
  multi_az             = true # Production requirement
}

# --- Caching (ElastiCache Redis) ---
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "athena-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
}

# --- Storage (S3) ---
resource "aws_s3_bucket" "media_bucket" {
  bucket = "athena-platform-media-prod"
}

resource "aws_s3_bucket" "media_bucket_us" {
  provider = aws.us
  count    = var.enable_us_region ? 1 : 0
  bucket   = "athena-platform-media-us"
}

resource "aws_s3_bucket" "media_bucket_sea" {
  provider = aws.sea
  count    = var.enable_sea_region ? 1 : 0
  bucket   = "athena-platform-media-sea"
}

resource "aws_s3_bucket" "media_bucket_mea" {
  provider = aws.mea
  count    = var.enable_mea_region ? 1 : 0
  bucket   = "athena-platform-media-mea"
}

resource "aws_s3_bucket_acl" "media_acl" {
  bucket = aws_s3_bucket.media_bucket.id
  acl    = "private"
}

# --- Compute (ECS Fargate) ---
resource "aws_ecs_cluster" "main" {
  name = "athena-cluster"
}

resource "aws_ecs_cluster" "us" {
  provider = aws.us
  count    = var.enable_us_region ? 1 : 0
  name     = "athena-cluster-us"
}

resource "aws_ecs_cluster" "sea" {
  provider = aws.sea
  count    = var.enable_sea_region ? 1 : 0
  name     = "athena-cluster-sea"
}

resource "aws_ecs_cluster" "mea" {
  provider = aws.mea
  count    = var.enable_mea_region ? 1 : 0
  name     = "athena-cluster-mea"
}

# --- Variables ---
variable "db_password" {
  description = "The password for the database"
  type        = string
  sensitive   = true
}

variable "primary_region" {
  description = "Primary AWS region"
  type        = string
  default     = "ap-southeast-2"
}

variable "us_region" {
  description = "US expansion region"
  type        = string
  default     = "us-east-1"
}

variable "sea_region" {
  description = "Southeast Asia expansion region"
  type        = string
  default     = "ap-southeast-1"
}

variable "mea_region" {
  description = "Middle East & Africa expansion region"
  type        = string
  default     = "me-south-1"
}

variable "enable_us_region" {
  description = "Enable US region resources"
  type        = bool
  default     = false
}

variable "enable_sea_region" {
  description = "Enable SEA region resources"
  type        = bool
  default     = false
}

variable "enable_mea_region" {
  description = "Enable MEA region resources"
  type        = bool
  default     = false
}
