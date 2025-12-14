terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.50"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "aws_account_id" {
  type = string
}

variable "ecr_repository_name" {
  type    = string
  default = "turbotax-poc"
}

variable "container_image" {
  description = "Full image URI (account.dkr.ecr.*.amazonaws.com/repo:tag). If empty, terraform prints outputs and admin can update service manually."
  type        = string
  default     = ""
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "task_cpu" {
  type    = number
  default = 256
}

variable "task_memory" {
  type    = number
  default = 512
}

variable "vpc_id" {
  type    = string
  default = "" # optional - default VPC will be used when unset
}

variable "public_subnets" {
  type    = list(string)
  default = []
  description = "List of public subnet IDs to deploy tasks and ALB into. If empty the default VPC subnets will be used."
}

variable "certificate_arn" {
  type    = string
  default = "" # optional ACM certificate for HTTPS listener
}

variable "secrets_map" {
  type = map(string)
  default = {}
  description = "Map of secret names -> secret values (Terraform will create AWS Secrets Manager secrets). For CI recommended to create secrets using GitHub Actions instead of embedding sensitive values here."
}
