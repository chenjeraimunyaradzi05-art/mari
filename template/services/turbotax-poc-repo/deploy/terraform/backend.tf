terraform {
  backend "s3" {
    bucket         = "" # <-- set when you configure remote state
    key            = "turbotax-poc/terraform.tfstate"
    region         = var.region
    dynamodb_table = "" # optional: lock table name
    encrypt        = true
  }
}
